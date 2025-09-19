const { User, Role, Vendor, Store, UserRole, VendorFollower } = require("../models");
const bcrypt = require("bcryptjs");
const logger = require("../utils/logger");
const { Op } = require("sequelize");
const { default: slugify } = require("slugify");
const { sendEmail, sendWelcomeEmail } = require("../services/email.service");
const AppError = require("../utils/appError");

// Generate a random 6-digit code and expiration time (10 minutes from now)
const generateVerificationCode = () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + 10); // Token expires in 10 min
  return { code, expires };
};

// Hash the verification code
const hashVerificationCode =  (code) => {
  return bcrypt.hashSync(code, 10);
};


/**
 * Register a new vendor
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const registerVendor = async (req, res) => {
  const transaction = await User.sequelize.transaction();

  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      business_name,
      cac_number,
      instagram_handle,
      facebook_handle,
      twitter_handle,
      join_reason,
    } = req.body;
    const password = process.env.DEFAULT_VENDOR_PASSWORD;
    const hashedPassword = hashVerificationCode(password);
    // Check if email or phone already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { phone }],
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "A user with this email or phone number already exists",
      });
    }

    // Validate CAC number format if provided
    if (cac_number) {
      const cacRegex = /^(RC|BN)\/\d{7}$/;
      if (!cacRegex.test(cac_number)) {
        await transaction.rollback();
        return res.status(400).json({
          status: "error",
          message: "Invalid CAC number format. Expected format: RC/1234567 or BN/1234567"
        });
      }

      // Check if CAC number is already registered
      const existingStore = await Store.findOne({
        where: {
          cac_number: {
            [Op.like]: cac_number
          }
        },
        transaction
      });

      if (existingStore) {
        await transaction.rollback();
        return res.status(400).json({
          status: "error",
          message: "This CAC number is already registered"
        });
      }
    }

    // Get or generate store slug
    const storeSlug = slugify(business_name, { lower: true });
    const existingStore = await Store.findOne({
      where: { slug: storeSlug },
      transaction,
    });

    if (existingStore) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message:
          "This store URL is already taken. Please choose a different one.",
      });
    }

    // Generate and store verification code with expiration
    const { code: verificationCode, expires: tokenExpires } = generateVerificationCode();
    const hashedCode = hashVerificationCode(verificationCode);

    // Calculate minutes until expiration
    const minutesUntilExpiry = Math.ceil((tokenExpires - new Date()) / (1000 * 60));
    
    // Create user
    const user = await User.create(
      {
        first_name,
        last_name,
        email,
        phone,
        password: hashedPassword,
        email_verified_at: null, // Implement email verification
        email_verification_token: hashedCode,
        email_verification_token_expires: tokenExpires,
        is_active: false,
      },
      { transaction }
    );

    // Send welcome email with verification code
    try {
      await sendWelcomeEmail(email, `${first_name} ${last_name}`, verificationCode, minutesUntilExpiry);
    } catch (err) {
      logger.error(`Error sending welcome email: ${err.message}`);
      // Don't fail the registration if email sending fails
    }

    // Create store
    const newStore = await Store.create({
      business_name,
      slug: storeSlug,
      cac_number: cac_number ? cac_number.trim() : null,
        instagram_handle,
        facebook_handle,
        twitter_handle,
        status: 1, // Active
        is_verified: false, // Will be verified by admin later
      },
      { transaction }
    );

    // Create vendor
    await Vendor.create(
      {
        user_id: user.id,
        store_id: newStore.id,
        join_reason,
        status: "pending", // Will be approved by admin
      },
      { transaction }
    );

    // Get vendor role
    const vendorRole = await Role.findOne({
      where: { name: "vendor" },
      transaction,
    });

    if (!vendorRole) {
      await transaction.rollback();
      return res.status(500).json({
        status: "error",
        message: "Vendor role not found. Please contact support.",
      });
    }

    // Assign vendor role to user
    console.log('User:', user);
    console.log('VendorRole:', vendorRole);
    
    try {
      // Use the correct method to add role through the belongsToMany association
      await user.addRoles([vendorRole.id], { 
        through: { 
          user_id: user.id,
          role_id: vendorRole.id,
          created_at: new Date()
        },
        transaction 
      });
      
      console.log('Successfully assigned role to user');
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }

    // Commit transaction
    await transaction.commit();

    // TODO: Send notification to admin about new vendor registration

    // Omit sensitive data from response
    const userJson = user.toJSON();
    delete userJson.password;
    delete userJson.password_reset_token;
    delete userJson.password_reset_expires;

    res.status(201).json({
      status: "success",
      message:
        "Vendor registration successful. Your account is pending approval.",
      data: {
        user: userJson,
        store: {
          ...newStore.toJSON(),
          slug: storeSlug,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Vendor registration error:", error);

    res.status(500).json({
      status: "error",
      message: "An error occurred during vendor registration",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get vendor profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
      include: [
        {
          model: Store,
          as: "Store",
          attributes: { exclude: ["created_at", "updated_at"] },
        },
        {
          model: User,
          as: "User",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "email_verified_at",
          ],
        },
      ],
    });

    if (!vendor) {
      return res.status(404).json({
        status: "error",
        message: "Vendor profile not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: vendor,
    });
  } catch (error) {
    logger.error("Get vendor profile error:", error);

    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching vendor profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Complete vendor onboarding
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const completeOnboarding = async (req, res, next) => {
  const transaction = await Vendor.sequelize.transaction();
  
  try {
    const { bank_account_name, bank_account_number, bank_name, description, cac_number } = req.body;
    const uploadedFiles = req.uploadedFiles || [];
    const vendorId = req.user.id;
    
    // Log the request body and files for debugging
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Uploaded files count:', uploadedFiles.length);

    // Separate logo from business images
    let logo = null;
    const business_images = [];
    
    console.log('Uploaded files:', JSON.stringify(uploadedFiles, null, 2));
    
    // Process uploaded files from req.uploadedFiles (passed from the route middleware)
    for (const file of uploadedFiles) {
      console.log(`Processing file field: ${file.fieldname}`, file);
      
      if (file.fieldname === 'logo') {
        // Use the URL that was already processed in the route middleware
        logo = file.url || null;
        console.log('Logo URL set to:', logo);
      } else if (file.fieldname === 'business_images') {
        // Only add valid files
        if (file && file.url) {
          const imgInfo = {
            url: file.url,
            alt: file.name || 'Business image',
            size: file.size || 0,
            mimeType: file.mimetype || 'image/jpeg'
          };
          console.log('Adding business image:', imgInfo);
          business_images.push(imgInfo);
        }
      }
    }

    // Validate we have at least one business image
    if (business_images.length === 0) {
      await transaction.rollback();
      return next(new AppError('At least one business image is required', 400));
    }

    // If CAC number is being updated in the onboarding, validate it
    if (req.body.cac_number) {
      const cac_number = req.body.cac_number.trim();
      const cacRegex = /^[A-Z]{2,3}\/\d{4,5}\d{5,7}$/i;
      
      if (!cacRegex.test(cac_number)) {
        await transaction.rollback();
        return next(new AppError('Invalid CAC number format. Expected format: RC/1234567 or BN/1234567', 400));
      }

      // Check if CAC number is already registered to another store
      const existingStore = await Store.findOne({
        where: {
          id: { [Op.ne]: vendor.Store.id }, // Exclude current store
          cac_number: {
            [Op.iLike]: cac_number
          }
        },
        transaction
      });

      if (existingStore) {
        await transaction.rollback();
        return next(new AppError('This CAC number is already registered to another store', 400));
      }

      // Add CAC number to update data
      updateData.cac_number = cac_number;
    }

    // Get vendor with store
    const vendor = await Vendor.findOne({
      where: { user_id: vendorId },
      include: [{
        model: Store,
        as: 'Store'
      }],
      transaction
    });

    if (!vendor) {
      await transaction.rollback();
      return next(new AppError('Vendor not found', 404));
    }

    // Prepare update data with processed files
    const updateData = {
      bank_account_name,
      bank_account_number,
      bank_name,
      description: description || null,
      logo: logo || null,
      business_images: JSON.stringify(business_images),
      is_verified: false, // Set to false initially, admin will verify
      status: 'pending', // Set status to pending review
      cac_number: cac_number || null,
    };

    console.log('Updating store with data:', JSON.stringify(updateData, null, 2));

    // Update store with the prepared data
    try {
      // First, get the store instance
      const store = await Store.findByPk(vendor.Store.id, { transaction });
      if (!store) {
        throw new Error('Store not found');
      }
      
      // Log the update data before updating
      console.log('Updating store with data:', JSON.stringify({
        ...updateData,
        business_images: business_images // Show the actual array, not the stringified version
      }, null, 2));
      
      // Update only the changed fields
      const updatedFields = {};
      Object.keys(updateData).forEach(key => {
        if (JSON.stringify(store[key]) !== JSON.stringify(updateData[key])) {
          updatedFields[key] = updateData[key];
        }
      });
      
      if (Object.keys(updatedFields).length > 0) {
        await store.update(updatedFields, { transaction });
        console.log('Store updated successfully');
      } else {
        console.log('No changes detected in store data');
      }
    } catch (error) {
      console.error('Error updating store:', error);
      throw error;
    }

    // Update vendor status to 'registration_complete'
    await vendor.update({
      status: 'registration_complete'
    }, { transaction });

    await transaction.commit();

    // TODO: Send notification to admin about completed onboarding
    
    res.status(200).json({
      status: 'success',
      message: 'Onboarding completed successfully. Your information is under review.'
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Complete onboarding error:', error);
    next(error);
  }
};

/**
 * Get all vendors (Public or Admin)
 */
const getAllVendors = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (status) whereClause.status = status;

    const { count, rows: vendors } = await Vendor.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'email_verified_at']
        },
        {
          model: Store,
          as: 'Store',
          attributes: { exclude: ['created_at', 'updated_at'] }
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      results: vendors.length,
      total: count,
      data: vendors
    });
  } catch (error) {
    logger.error('Get all vendors error:', error);
    next(error);
  }
};

/**
 * Get vendor by ID (Admin only)
 */
const getVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'email_verified_at']
        },
        {
          model: Store,
          as: 'Store',
          attributes: { exclude: ['created_at', 'updated_at'] }
        }
      ]
    });

    if (!vendor) {
      return next(new AppError('Vendor not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: vendor
    });
  } catch (error) {
    logger.error('Get vendor error:', error);
    next(error);
  }
};

/**
 * Approve vendor (Admin only)
 */
const approveVendor = async (req, res, next) => {
  const transaction = await Vendor.sequelize.transaction();
  
  try {
    const vendor = await Vendor.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'User'
        },
        {
          model: Store,
          as: 'Store'
        }
      ],
      transaction
    });

    if (!vendor) {
      await transaction.rollback();
      return next(new AppError('Vendor not found', 404));
    }

    if (vendor.status === 'approved') {
      await transaction.rollback();
      return next(new AppError('Vendor is already approved', 400));
    }

    // Update vendor status
    await vendor.update({
      status: 'approved',
      approved_by: req.user.id,
      approved_at: new Date()
    }, { transaction });

    // Update store verification status
    await vendor.Store.update({
      is_verified: true
    }, { transaction });

    // Send approval email to vendor
    try {
      await sendEmail(
        vendor.User.email,
        'VENDOR_APPROVED',
        {
          name: `${vendor.User.first_name} ${vendor.User.last_name}`,
          storeName: vendor.Store.business_name,
          loginUrl: `${process.env.FRONTEND_URL}/vendor/login`,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@stylay.ng'
        }
      );
    } catch (emailError) {
      logger.error('Error sending vendor approval email:', emailError);
      // Don't fail the request if email fails
    }

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Vendor approved successfully',
      data: {
        id: vendor.id,
        status: 'approved',
        approved_at: new Date()
      }
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Approve vendor error:', error);
    next(error);
  }
};

/**
 * Reject vendor (Admin only)
 */
const rejectVendor = async (req, res, next) => {
  const transaction = await Vendor.sequelize.transaction();
  
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return next(new AppError('Please provide a reason for rejection', 400));
    }

    const vendor = await Vendor.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'User'
        },
        {
          model: Store,
          as: 'Store'
        }
      ],
      transaction
    });

    if (!vendor) {
      await transaction.rollback();
      return next(new AppError('Vendor not found', 404));
    }

    if (vendor.status === 'rejected') {
      await transaction.rollback();
      return next(new AppError('Vendor is already rejected', 400));
    }

    // Update vendor status
    await vendor.update({
      status: 'rejected',
      rejection_reason: reason,
      approved_by: req.user.id,
      approved_at: new Date()
    }, { transaction });

    // Send rejection email to vendor
    try {
      await sendEmail({
        to: vendor.User.email,
        subject: 'Your Vendor Application Status',
        template: 'vendor-rejected',
        context: {
          name: `${vendor.User.first_name} ${vendor.User.last_name}`,
          storeName: vendor.Store.business_name,
          reason: reason,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@stylay.ng',
          contactUrl: `${process.env.FRONTEND_URL}/contact`
        }
      });
    } catch (emailError) {
      logger.error('Error sending vendor rejection email:', emailError);
      // Don't fail the request if email fails
    }

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Vendor rejected successfully',
      data: {
        id: vendor.id,
        status: 'rejected',
        rejected_at: new Date()
      }
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Reject vendor error:', error);
    next(error);
  }
};

/**
 * Follow a vendor
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const followVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;

    // Check if vendor exists
    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      return next(new AppError('Vendor not found', 404));
    }

    // Check if user is trying to follow themselves
    if (vendor.user_id === userId) {
      return next(new AppError('You cannot follow yourself', 400));
    }

    // Check if already following
    const existingFollow = await VendorFollower.findOne({
      where: {
        user_id: userId,
        vendor_id: vendorId
      }
    });

    if (existingFollow) {
      return next(new AppError('You are already following this vendor', 400));
    }

    // Create follow relationship
    await VendorFollower.create({
      user_id: userId,
      vendor_id: vendorId
    });

    res.status(201).json({
      status: 'success',
      message: 'Successfully followed vendor'
    });
  } catch (error) {
    logger.error('Follow vendor error:', error);
    next(error);
  }
};

/**
 * Unfollow a vendor
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const unfollowVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;

    // Check if follow relationship exists
    const follow = await VendorFollower.findOne({
      where: {
        user_id: userId,
        vendor_id: vendorId
      }
    });

    if (!follow) {
      return next(new AppError('You are not following this vendor', 400));
    }

    // Remove follow relationship
    await follow.destroy();

    res.status(200).json({
      status: 'success',
      message: 'Successfully unfollowed vendor'
    });
  } catch (error) {
    logger.error('Unfollow vendor error:', error);
    next(error);
  }
};

/**
 * Get followers of a vendor
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getVendorFollowers = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Check if vendor exists
    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      return next(new AppError('Vendor not found', 404));
    }

    const { count, rows: followers } = await VendorFollower.findAndCountAll({
      where: { vendor_id: vendorId },
      include: [
        {
          model: User,
          as: 'follower',
          attributes: ['id', 'first_name', 'last_name', 'email', 'profile_image']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      results: followers.length,
      total: count,
      data: followers
    });
  } catch (error) {
    logger.error('Get vendor followers error:', error);
    next(error);
  }
};

/**
 * Get vendors followed by a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserFollowing = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: following } = await VendorFollower.findAndCountAll({
      where: { user_id: userId },
      include: [
        {
          model: Vendor,
          as: 'vendor',
          include: [
            {
              model: User,
              as: 'User',
              attributes: ['id', 'first_name', 'last_name']
            },
            {
              model: Store,
              as: 'store',
              attributes: ['business_name', 'slug', 'logo']
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      results: following.length,
      total: count,
      data: following
    });
  } catch (error) {
    logger.error('Get user following error:', error);
    next(error);
  }
};

/**
 * Check if user is following a vendor
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkFollowStatus = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;

    const follow = await VendorFollower.findOne({
      where: {
        user_id: userId,
        vendor_id: vendorId
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        isFollowing: !!follow
      }
    });
  } catch (error) {
    logger.error('Check follow status error:', error);
    next(error);
  }
};

/**
 * Get followers of the authenticated vendor (Vendor only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMyFollowers = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get vendor details to ensure it exists
    const vendor = await Vendor.findOne({
      where: { user_id: vendorId },
      include: [
        {
          model: Store,
          as: 'Store',
          attributes: ['business_name']
        }
      ]
    });

    if (!vendor) {
      return next(new AppError('Vendor profile not found', 404));
    }

    const { count, rows: followers } = await VendorFollower.findAndCountAll({
      where: { vendor_id: vendor.id },
      include: [
        {
          model: User,
          as: 'follower',
          attributes: ['id', 'first_name', 'last_name', 'email', 'profile_image', 'created_at']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      results: followers.length,
      total: count,
      data: {
        vendor: {
          id: vendor.id,
          business_name: vendor.Store.business_name
        },
        followers: followers
      }
    });
  } catch (error) {
    logger.error('Get my followers error:', error);
    next(error);
  }
};

module.exports = {
  registerVendor,
  getVendorProfile,
  completeOnboarding,
  getAllVendors,
  getVendor,
  approveVendor,
  rejectVendor,
  followVendor,
  unfollowVendor,
  getVendorFollowers,
  getUserFollowing,
  checkFollowStatus,
  getMyFollowers
};
