const {
  User,
  Role,
  Vendor,
  Product,
  Store,
  Category,
  ProductImage,
  VendorFollower,
} = require("../models");
const bcrypt = require("bcryptjs");
const logger = require("../utils/logger");
const { Op } = require("sequelize");
const { default: slugify } = require("slugify");
const { sendEmail, sendWelcomeEmail } = require("../services/email.service");
const AppError = require("../utils/appError");
const fs = require("fs");

// Generate a random 6-digit code and expiration time (10 minutes from now)
const generateVerificationCode = () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + 10); // Token expires in 10 min
  return { code, expires };
};

// Hash the verification code
const hashVerificationCode = (code) => {
  return bcrypt.hashSync(code, 10);
};

// Enhanced registerVendor function in controllers/vendor.controller.js
// Replace lines 163-176 with this enhanced implementation

/**
 * Register a new vendor
 * @access Public
 * /api/v1/vendors/register
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
    const { password: providedPassword } = req.body;
    const finalPassword = providedPassword || process.env.DEFAULT_VENDOR_PASSWORD;
    
    if (!finalPassword) {
      await transaction.rollback();
      return res.status(400).json({
        status: "error",
        message: "Password required. Provide 'password' in request body or set DEFAULT_VENDOR_PASSWORD environment variable."
      });
    }
    
    const hashedPassword = bcrypt.hashSync(finalPassword, 12);
    logger.info(`Vendor registration for ${email}: using ${providedPassword ? 'provided' : 'default'} password`);
    
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
          message:
            "Invalid CAC number format. Expected format: RC/1234567 or BN/1234567",
        });
      }

      // Check if CAC number is already registered
      const existingStore = await Store.findOne({
        where: {
          cac_number: {
            [Op.like]: cac_number,
          },
        },
        transaction,
      });

      if (existingStore) {
        await transaction.rollback();
        return res.status(400).json({
          status: "error",
          message: "This CAC number is already registered",
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
    const { code: verificationCode, expires: tokenExpires } =
      generateVerificationCode();
    const hashedCode = hashVerificationCode(verificationCode);

    // Calculate minutes until expiration
    const minutesUntilExpiry = Math.ceil(
      (tokenExpires - new Date()) / (1000 * 60)
    );

    // Create user
    const user = await User.create(
      {
        first_name,
        last_name,
        email,
        phone,
        password: hashedPassword,
        email_verified_at: null,
        email_verification_token: hashedCode,
        email_verification_token_expires: tokenExpires,
        is_active: false,
      },
      { transaction }
    );

    // Send welcome email with verification code
    try {
      await sendWelcomeEmail(
        email,
        `${first_name} ${last_name}`,
        verificationCode,
        minutesUntilExpiry
      );
    } catch (err) {
      logger.error(`Error sending welcome email: ${err.message}`);
      // Don't fail the registration if email sending fails
    }

    // Create store
    const newStore = await Store.create(
      {
        business_name,
        slug: storeSlug,
        cac_number: cac_number ? cac_number.trim() : null,
        instagram_handle,
        facebook_handle,
        twitter_handle,
        status: 1, // Active
        is_verified: false,
      },
      { transaction }
    );

    // ===== ENHANCED BUSINESS IMAGES PROCESSING =====
    let businessImagesUrls = [];
    let uploadedFiles = [];
    
    if (req.uploadedFiles && req.uploadedFiles.length > 0) {
      const businessImages = req.uploadedFiles.filter(
        file => file.fieldname === 'businessImages'
      );
      uploadedFiles = businessImages; // Store for cleanup on error
      
      // Validate image count
      if (businessImages.length > 5) {
        await transaction.rollback();
        // Cleanup uploaded files
        businessImages.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
              logger.info(`Cleaned up file: ${file.path}`);
            } catch (unlinkError) {
              logger.warn(`Failed to cleanup file ${file.path}: ${unlinkError.message}`);
            }
          }
        });
        return res.status(400).json({
          status: "error",
          message: "Maximum 5 business images allowed"
        });
      }
      
      // Validate file types
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      const invalidFiles = businessImages.filter(
        file => !allowedTypes.includes(file.mimetype)
      );
      
      if (invalidFiles.length > 0) {
        await transaction.rollback();
        // Cleanup all uploaded files
        businessImages.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
              logger.info(`Cleaned up invalid file: ${file.path}`);
            } catch (unlinkError) {
              logger.warn(`Failed to cleanup file ${file.path}: ${unlinkError.message}`);
            }
          }
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid file type. Only JPEG, PNG, JPG, and WebP images are allowed. Found: ${invalidFiles.map(f => f.mimetype).join(', ')}`
        });
      }
      
      // Validate file sizes (5MB max per file)
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      const oversizedFiles = businessImages.filter(
        file => file.size > maxFileSize
      );
      
      if (oversizedFiles.length > 0) {
        await transaction.rollback();
        // Cleanup all uploaded files
        businessImages.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
              logger.info(`Cleaned up oversized file: ${file.path}`);
            } catch (unlinkError) {
              logger.warn(`Failed to cleanup file ${file.path}: ${unlinkError.message}`);
            }
          }
        });
        return res.status(400).json({
          status: "error",
          message: `File size exceeds maximum limit of 5MB. Oversized files: ${oversizedFiles.map(f => f.name).join(', ')}`
        });
      }
      
      // Extract URLs from successfully uploaded files
      businessImagesUrls = businessImages.map(file => file.url);
      
      logger.info(`Processed ${businessImages.length} business images for vendor: ${email}`);
    }

    // Update store with business images
    await newStore.update({
      business_images: JSON.stringify(businessImagesUrls)
    }, { transaction });
    // ===== END ENHANCED BUSINESS IMAGES PROCESSING =====

    // Create vendor
    await Vendor.create(
      {
        user_id: user.id,
        store_id: newStore.id,
        join_reason,
        status: "pending",
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
    try {
      await user.addRoles([vendorRole.id], {
        through: {
          user_id: user.id,
          role_id: vendorRole.id,
          created_at: new Date(),
        },
        transaction,
      });

      // Also assign customer role to vendors
      const customerRole = await Role.findOne({
        where: { name: 'customer' },
        transaction,
      });

      if (customerRole) {
        await user.addRoles([customerRole.id], {
          through: {
            user_id: user.id,
            role_id: customerRole.id,
            created_at: new Date(),
          },
          transaction,
        });
      }
    } catch (error) {
      logger.error("Error assigning roles:", error);
      throw error;
    }

    // Commit transaction
    await transaction.commit();

    // Omit sensitive data from response
    const userJson = user.toJSON();
    delete userJson.password;
    delete userJson.password_reset_token;
    delete userJson.password_reset_expires;

    res.status(201).json({
      status: "success",
      message: "Vendor registration successful. Your account is pending approval.",
      data: {
        user: userJson,
        store: {
          ...newStore.toJSON(),
          slug: storeSlug,
          business_images: businessImagesUrls, // Return parsed array for client
        },
      },
    });
  } catch (error) {
    await transaction.rollback();

    // Cleanup uploaded business images on error
    if (req.uploadedFiles && req.uploadedFiles.length > 0) {
      const businessImageFiles = req.uploadedFiles.filter(
        file => file.fieldname === 'businessImages'
      );
      businessImageFiles.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            logger.info(`Cleaned up file on error: ${file.path}`);
          } catch (unlinkError) {
            logger.warn(`Failed to cleanup file ${file.path}: ${unlinkError.message}`);
          }
        }
      });
    }

    logger.error("Vendor registration error:", error);

    res.status(500).json({
      status: "error",
      message: "An error occurred during vendor registration",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Retrieves the profile information for the authenticated vendor including user details and store information.
 * Returns comprehensive vendor data for profile management and display.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for vendor lookup
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor profile data
 * @returns {boolean} status - Success status
 * @returns {Object} data - Vendor profile information
 * @returns {number} data.id - Vendor ID
 * @returns {string} data.status - Vendor approval status
 * @returns {Object} data.User - Associated user information
 * @returns {number} data.User.id - User ID
 * @returns {string} data.User.first_name - First name
 * @returns {string} data.User.last_name - Last name
 * @returns {string} data.User.email - Email address
 * @returns {string} data.User.phone - Phone number
 * @returns {string} data.User.email_verified_at - Email verification timestamp
 * @returns {Object} data.store - Store/business information
 * @throws {AppError} 404 - When vendor profile not found
 * @api {get} /api/v1/vendors/vendor/profile Get Vendor Profile
 * @private vendor
 * @example
 * // Request
 * GET /api/v1/vendors/vendor/profile
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "id": 1,
 *     "status": "approved",
 *     "User": {
 *       "id": 1,
 *       "first_name": "John",
 *       "last_name": "Doe",
 *       "email": "john.doe@example.com",
 *       "phone": "+2348012345678",
 *       "email_verified_at": "2024-01-15T10:00:00.000Z"
 *     },
 *     "store": {
 *       "business_name": "Doe Enterprises",
 *       "slug": "doe-enterprises",
 *       "description": "Handmade crafts store",
 *       "logo": "https://example.com/logo.jpg"
 *     }
 *   }
 * }
 */
const getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      where: { user_id: req.user.id },
      include: [
        {
          model: Store,
          as: "store",
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
 * Completes the vendor onboarding process by updating store information with banking details,
 * business documentation, and file uploads. Sets vendor status to 'registration_complete' for admin review.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.body - Request body containing onboarding data
 * @param {string} req.body.bank_account_name - Bank account holder name (required)
 * @param {string} req.body.bank_account_number - Bank account number (required)
 * @param {string} req.body.bank_name - Bank name (required)
 * @param {string} [req.body.description] - Business description
 * @param {string} [req.body.cac_number] - CAC registration number (optional, validated)
 * @param {Object} [req.processedFiles] - Processed file upload data
 * @param {string} [req.processedFiles.logo] - Store logo URL
 * @param {Array<string>} [req.processedFiles.business_images] - Array of business image URLs
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for vendor lookup
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming onboarding completion
 * @returns {boolean} status - Success status
 * @returns {string} message - Success message about pending admin review
 * @throws {AppError} 404 - When vendor not found
 * @throws {AppError} 400 - When CAC number format is invalid or already registered
 * @api {post} /api/v1/vendors/complete-onboarding Complete Vendor Onboarding
 * @private vendor
 * @example
 * // Request
 * POST /api/v1/vendors/complete-onboarding
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 * {
 *   "bank_account_name": "John Doe",
 *   "bank_account_number": "0123456789",
 *   "bank_name": "Access Bank",
 *   "description": "We specialize in handmade crafts",
 *   "cac_number": "RC/1234567"
 * }
 * // Include file uploads for logo and business_images
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "message": "Onboarding completed successfully. Your information is under review."
 * }
 */
const completeOnboarding = async (req, res, next) => {
  const transaction = await Vendor.sequelize.transaction();

  try {
    const {
      bank_account_name,
      bank_account_number,
      bank_name,
      description,
      cac_number,
    } = req.body;
    const processedFiles = req.processedFiles || {};
    const vendorId = req.user.id;

    // Extract processed file data
    const logo = processedFiles.logo;
    const business_images = processedFiles.business_images || [];

    // Get vendor with store first to validate CAC number
    const vendor = await Vendor.findOne({
      where: { user_id: vendorId },
      include: [
        {
          model: Store,
          as: "store",
        },
      ],
      transaction,
    });

    if (!vendor) {
      await transaction.rollback();
      return next(new AppError("Vendor not found", 404));
    }

    // If CAC number is being updated in the onboarding, validate it
    let validatedCacNumber = cac_number || null;
    if (req.body.cac_number) {
      const cac_number_trimmed = req.body.cac_number.trim();
      const cacRegex = /^[A-Z]{2,3}\/\d{4,5}\d{5,7}$/i;

      if (!cacRegex.test(cac_number_trimmed)) {
        await transaction.rollback();
        return next(
          new AppError(
            "Invalid CAC number format. Expected format: RC/1234567 or BN/1234567",
            400
          )
        );
      }

      // Check if CAC number is already registered to another store
      const existingStore = await Store.findOne({
        where: {
          id: { [Op.ne]: vendor.Store.id }, // Exclude current store
          cac_number: {
            [Op.like]: cac_number_trimmed.toLowerCase(),
          },
        },
        transaction,
      });

      if (existingStore) {
        await transaction.rollback();
        return next(
          new AppError(
            "This CAC number is already registered to another store",
            400
          )
        );
      }

      validatedCacNumber = cac_number_trimmed;
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
      status: "pending", // Set status to pending review
      cac_number: validatedCacNumber,
    };

    console.log(
      "Updating store with data:",
      JSON.stringify(updateData, null, 2)
    );

    // Update store with the prepared data
    try {
      // First, get the store instance
      const store = await Store.findByPk(vendor.Store.id, { transaction });
      if (!store) {
        throw new Error("Store not found");
      }

      // Log the update data before updating
      console.log(
        "Updating store with data:",
        JSON.stringify(
          {
            ...updateData,
            business_images: business_images, // Show the actual array, not the stringified version
          },
          null,
          2
        )
      );

      // Update only the changed fields
      const updatedFields = {};
      Object.keys(updateData).forEach((key) => {
        if (JSON.stringify(store[key]) !== JSON.stringify(updateData[key])) {
          updatedFields[key] = updateData[key];
        }
      });

      if (Object.keys(updatedFields).length > 0) {
        await store.update(updatedFields, { transaction });
        console.log("Store updated successfully");
      } else {
        console.log("No changes detected in store data");
      }
    } catch (error) {
      console.error("Error updating store:", error);
      throw error;
    }

    // Update vendor status to 'registration_complete'
    await vendor.update(
      {
        status: "registration_complete",
      },
      { transaction }
    );

    await transaction.commit();

    // TODO: Send notification to admin about completed onboarding

    res.status(200).json({
      status: "success",
      message:
        "Onboarding completed successfully. Your information is under review.",
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Complete onboarding error:", error);

    // Clean up uploaded files if onboarding failed
    console.log('=== CLEANUP DIAGNOSTICS ===');
    console.log('req.processedFiles structure:', JSON.stringify(req.processedFiles, null, 2));
    console.log('req.uploadedFiles structure:', JSON.stringify(req.uploadedFiles, null, 2));
    
    if (req.processedFiles) {
      const files = [];
      console.log('Checking for logo file...');
      if (req.processedFiles.logo && typeof req.processedFiles.logo === 'object' && req.processedFiles.logo.path) {
        console.log('Found logo with path:', req.processedFiles.logo.path);
        files.push(req.processedFiles.logo.path);
      } else {
        console.log('Logo cleanup condition failed. Type:', typeof req.processedFiles.logo);
        console.log('Logo value:', req.processedFiles.logo);
      }
      
      console.log('Checking for business images...');
      if (req.processedFiles.business_images && Array.isArray(req.processedFiles.business_images)) {
        console.log('Found business_images array:', req.processedFiles.business_images);
        req.processedFiles.business_images.forEach((img, index) => {
          console.log(`Business image ${index}:`, typeof img, img);
          if (img.path) {
            console.log(`Found business image path: ${img.path}`);
            files.push(img.path);
          } else {
            console.log(`Business image ${index} has no .path property`);
          }
        });
      } else {
        console.log('business_images is not an array or doesn\'t exist');
      }
      
      console.log('Files to clean up:', files);
      
      files.forEach(path => {
        console.log(`Attempting to clean up: ${path}`);
        if (fs.existsSync(path)) {
          try {
            fs.unlinkSync(path);
            console.log(`✓ Cleaned up file: ${path}`);
          } catch (cleanupError) {
            console.warn(`✗ Failed to clean up file ${path}:`, cleanupError.message);
          }
        } else {
          console.warn(`✗ File does not exist: ${path}`);
        }
      });
    } else {
      console.log('No req.processedFiles found for cleanup');
    }
    
    // Also try to clean up from req.uploadedFiles as fallback
    if (req.uploadedFiles && req.uploadedFiles.length > 0) {
      console.log('Attempting cleanup from req.uploadedFiles...');
      req.uploadedFiles.forEach((file, index) => {
        console.log(`Uploaded file ${index}:`, {
          fieldname: file.fieldname,
          path: file.path,
          url: file.url,
          exists: fs.existsSync(file.path)
        });
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log(`✓ Cleaned up uploaded file: ${file.path}`);
          } catch (cleanupError) {
            console.warn(`✗ Failed to clean up uploaded file ${file.path}:`, cleanupError.message);
          }
        }
      });
    }
    
    // NEW: Try to clean up using stored file objects from middleware
    if (req.processedFiles) {
      console.log('=== NEW CLEANUP METHOD DIAGNOSTICS ===');
      
      // Clean up logo file if it exists
      if (req.processedFiles.logoFile) {
        console.log('Found logoFile object:', {
          fieldname: req.processedFiles.logoFile.fieldname,
          path: req.processedFiles.logoFile.path,
          url: req.processedFiles.logoFile.url
        });
        const logoPath = req.processedFiles.logoFile.path;
        if (logoPath && fs.existsSync(logoPath)) {
          try {
            fs.unlinkSync(logoPath);
            console.log(`✓ NEW METHOD: Cleaned up logo file: ${logoPath}`);
          } catch (cleanupError) {
            console.warn(`✗ NEW METHOD: Failed to clean up logo file ${logoPath}:`, cleanupError.message);
          }
        } else {
          console.warn(`✗ NEW METHOD: Logo file does not exist: ${logoPath}`);
        }
      } else {
        console.log('No logoFile object found in processedFiles');
      }
      
      // Clean up business image files if they exist
      if (req.processedFiles.businessImageFiles && Array.isArray(req.processedFiles.businessImageFiles)) {
        console.log(`Found ${req.processedFiles.businessImageFiles.length} business image files`);
        req.processedFiles.businessImageFiles.forEach((file, index) => {
          console.log(`Business image file ${index}:`, {
            fieldname: file.fieldname,
            path: file.path,
            url: file.url
          });
          const imagePath = file.path;
          if (imagePath && fs.existsSync(imagePath)) {
            try {
              fs.unlinkSync(imagePath);
              console.log(`✓ NEW METHOD: Cleaned up business image ${index}: ${imagePath}`);
            } catch (cleanupError) {
              console.warn(`✗ NEW METHOD: Failed to clean up business image ${imagePath}:`, cleanupError.message);
            }
          } else {
            console.warn(`✗ NEW METHOD: Business image ${index} does not exist: ${imagePath}`);
          }
        });
      } else {
        console.log('No businessImageFiles array found in processedFiles');
      }
    }

    next(error);
  }
};

/**
 * Retrieves paginated list of products belonging to a specific vendor.
 * Includes category and image information for product display.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Vendor ID
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=12] - Number of products per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor's products
 * @returns {boolean} success - Success flag
 * @returns {number} count - Number of products in current page
 * @returns {number} total - Total number of products by vendor
 * @returns {Array} data - Array of product objects
 * @returns {number} data[].id - Product ID
 * @returns {string} data[].name - Product name
 * @returns {string} data[].slug - Product slug
 * @returns {string} data[].description - Product description
 * @returns {number} data[].price - Product price
 * @returns {Object} data[].Category - Product category info
 * @returns {Array} data[].images - Product images (first image only)
 * @throws {AppError} 404 - When vendor not found
 * @api {get} /api/v1/vendors/:id/products Get Vendor Products
 * @public
 * @example
 * // Request
 * GET /api/v1/vendors/5/products?page=1&limit=10
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 8,
 *   "total": 25,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Wireless Headphones",
 *       "slug": "wireless-headphones",
 *       "description": "High-quality wireless headphones",
 *       "price": 99.99,
 *       "Category": {"id": 1, "name": "Electronics"},
 *       "images": [{"id": 1, "image_url": "https://example.com/image.jpg"}]
 *     }
 *   ]
 * }
 */
const getVendorProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    const vendor = await Vendor.findByPk(req.params.id);

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: { vendor_id: req.params.id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        { model: ProductImage, limit: 1, as: "images" }, // Only get first image for listing
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a paginated list of all vendors with optional filtering by status.
 * Public access shows general vendor information; admin access may show additional details.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.status] - Filter vendors by status (pending, approved, rejected)
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of vendors per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated vendor list
 * @returns {boolean} status - Success status
 * @returns {number} results - Number of vendors in current page
 * @returns {number} total - Total number of vendors matching criteria
 * @returns {Array} data - Array of vendor objects
 * @returns {number} data[].id - Vendor ID
 * @returns {string} data[].status - Vendor approval status
 * @returns {Object} data[].User - Associated user information
 * @returns {Object} data[].store - Store/business information
 * @api {get} /api/v1/vendors Get All Vendors
 * @public
 * @example
 * // Request
 * GET /api/v1/vendors?page=1&limit=10&status=approved
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "results": 8,
 *   "total": 25,
 *   "data": [
 *     {
 *       "id": 1,
 *       "status": "approved",
 *       "User": {
 *         "id": 1,
 *         "first_name": "John",
 *         "last_name": "Doe",
 *         "email": "john.doe@example.com"
 *       },
 *       "store": {
 *         "business_name": "Doe Enterprises",
 *         "slug": "doe-enterprises",
 *         "logo": "https://example.com/logo.jpg"
 *       }
 *     }
 *   ]
 * }
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
          as: "User",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "profile_image",
            "email_verified_at",
          ],
        },
        {
          model: Store,
          as: "store",
          attributes: { exclude: ["created_at", "updated_at"] },
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      results: vendors.length,
      total: count,
      data: vendors,
    });
  } catch (error) {
    logger.error("Get all vendors error:", error);
    next(error);
  }
};

/**
 * Retrieves detailed information about a specific vendor by their ID.
 * Includes user and store information for public vendor profile display.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Vendor ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor details
 * @returns {boolean} status - Success status
 * @returns {Object} data - Vendor information
 * @returns {number} data.id - Vendor ID
 * @returns {string} data.status - Vendor approval status
 * @returns {Object} data.User - Associated user information
 * @returns {Object} data.store - Store/business information
 * @throws {AppError} 404 - When vendor not found
 * @api {get} /api/v1/vendors/:id Get Vendor by ID
 * @public
 * @example
 * // Request
 * GET /api/v1/vendors/123
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "id": 123,
 *     "status": "approved",
 *     "User": {
 *       "id": 1,
 *       "first_name": "John",
 *       "last_name": "Doe",
 *       "email": "john.doe@example.com",
 *       "phone": "+2348012345678"
 *     },
 *     "store": {
 *       "business_name": "Doe Enterprises",
 *       "slug": "doe-enterprises",
 *       "description": "Handmade crafts store",
 *       "logo": "https://example.com/logo.jpg"
 *     }
 *   }
 * }
 */
const getVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "User",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "profile_image",
            "email_verified_at",
          ],
        },
        {
          model: Store,
          as: "store",
          attributes: { exclude: ["created_at", "updated_at"] },
        },
      ],
    });

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: vendor,
    });
  } catch (error) {
    logger.error("Get vendor error:", error);
    next(error);
  }
};

/**
 * Approves a vendor application, changing their status from pending to approved.
 * Updates both vendor and store verification status, and sends approval notification email.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Vendor ID to approve
 * @param {Object} req.user - Authenticated admin user info
 * @param {number} req.user.id - Admin user ID for audit trail
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with approval confirmation
 * @returns {boolean} status - Success status
 * @returns {string} message - Success message
 * @returns {Object} data - Approval details
 * @returns {number} data.id - Vendor ID
 * @returns {string} data.status - Updated vendor status ('approved')
 * @returns {string} data.approved_at - Approval timestamp
 * @throws {AppError} 404 - When vendor not found
 * @throws {AppError} 400 - When vendor is already approved
 * @api {post} /api/v1/vendors/:id/approve Approve Vendor
 * @private admin
 * @example
 * // Request
 * POST /api/v1/vendors/123/approve
 * Authorization: Bearer <admin_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "message": "Vendor approved successfully",
 *   "data": {
 *     "id": 123,
 *     "status": "approved",
 *     "approved_at": "2024-09-26T05:00:00.000Z"
 *   }
 * }
 */
const approveVendor = async (req, res, next) => {
  const transaction = await Vendor.sequelize.transaction();

  try {
    const vendor = await Vendor.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "User",
        },
        {
          model: Store,
          as: "store",
        },
      ],
      transaction,
    });

    if (!vendor) {
      await transaction.rollback();
      return next(new AppError("Vendor not found", 404));
    }

    if (vendor.status === "approved") {
      await transaction.rollback();
      return next(new AppError("Vendor is already approved", 400));
    }

    // Update vendor status
    await vendor.update(
      {
        status: "approved",
        approved_by: req.user.id,
        approved_at: new Date(),
      },
      { transaction }
    );

    // Update store verification status
    await vendor.store.update(
      {
        is_verified: true,
      },
      { transaction }
    );

    // Send approval email to vendor
    try {
      await sendEmail(vendor.User.email, "VENDOR_APPROVED", {
        name: `${vendor.User.first_name} ${vendor.User.last_name}`,
        storeName: vendor.store.business_name,
        loginUrl: `${process.env.FRONTEND_URL}/vendor/login`,
        supportEmail: process.env.SUPPORT_EMAIL || "support@stylay.ng",
      });
    } catch (emailError) {
      logger.error("Error sending vendor approval email:", emailError);
      // Don't fail the request if email fails
    }

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Vendor approved successfully",
      data: {
        id: vendor.id,
        status: "approved",
        approved_at: new Date(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Approve vendor error:", error);
    next(error);
  }
};

/**
 * Rejects a vendor application with a specified reason, preventing them from selling on the platform.
 * Sends rejection notification email with the provided reason.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Vendor ID to reject
 * @param {Object} req.body - Request body
 * @param {string} req.body.reason - Reason for rejection (required)
 * @param {Object} req.user - Authenticated admin user info
 * @param {number} req.user.id - Admin user ID for audit trail
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with rejection confirmation
 * @returns {boolean} status - Success status
 * @returns {string} message - Success message
 * @returns {Object} data - Rejection details
 * @returns {number} data.id - Vendor ID
 * @returns {string} data.status - Updated vendor status ('rejected')
 * @returns {string} data.rejected_at - Rejection timestamp
 * @throws {AppError} 400 - When reason is not provided or vendor already rejected
 * @throws {AppError} 404 - When vendor not found
 * @api {post} /api/v1/vendors/:id/reject Reject Vendor
 * @private admin
 * @example
 * // Request
 * POST /api/v1/vendors/123/reject
 * Authorization: Bearer <admin_token>
 * {
 *   "reason": "Incomplete documentation provided"
 * }
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "message": "Vendor rejected successfully",
 *   "data": {
 *     "id": 123,
 *     "status": "rejected",
 *     "rejected_at": "2024-09-26T05:00:00.000Z"
 *   }
 * }
 */
const rejectVendor = async (req, res, next) => {
  const transaction = await Vendor.sequelize.transaction();

  try {
    const { reason } = req.body;

    if (!reason) {
      return next(new AppError("Please provide a reason for rejection", 400));
    }

    const vendor = await Vendor.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "User",
        },
        {
          model: Store,
          as: "store",
        },
      ],
      transaction,
    });

    if (!vendor) {
      await transaction.rollback();
      return next(new AppError("Vendor not found", 404));
    }

    if (vendor.status === "rejected") {
      await transaction.rollback();
      return next(new AppError("Vendor is already rejected", 400));
    }

    // Update vendor status
    await vendor.update(
      {
        status: "rejected",
        rejection_reason: reason,
        approved_by: req.user.id,
        approved_at: new Date(),
      },
      { transaction }
    );

    // Send rejection email to vendor
    try {
      await sendEmail({
        to: vendor.User.email,
        subject: "Your Vendor Application Status",
        template: "vendor-rejected",
        context: {
          name: `${vendor.User.first_name} ${vendor.User.last_name}`,
          storeName: vendor.store.business_name,
          reason: reason,
          supportEmail: process.env.SUPPORT_EMAIL || "support@stylay.ng",
          contactUrl: `${process.env.FRONTEND_URL}/contact`,
        },
      });
    } catch (emailError) {
      logger.error("Error sending vendor rejection email:", emailError);
      // Don't fail the request if email fails
    }

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Vendor rejected successfully",
      data: {
        id: vendor.id,
        status: "rejected",
        rejected_at: new Date(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Reject vendor error:", error);
    next(error);
  }
};

/**
 * Creates a follow relationship between the authenticated user and a vendor.
 * Allows users to follow vendors to receive updates and stay connected.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.vendorId - Vendor ID to follow
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID creating the follow relationship
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming follow action
 * @returns {boolean} status - Success status
 * @returns {string} message - Success message
 * @throws {AppError} 404 - When vendor not found
 * @throws {AppError} 400 - When user tries to follow themselves or already following
 * @api {post} /api/v1/vendors/:vendorId/follow Follow Vendor
 * @private user
 * @example
 * // Request
 * POST /api/v1/vendors/123/follow
 * Authorization: Bearer <token>
 *
 * // Success Response (201)
 * {
 *   "status": "success",
 *   "message": "Successfully followed vendor"
 * }
 */
const followVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;

    // Check if vendor exists
    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    // Check if user is trying to follow themselves
    if (vendor.user_id === userId) {
      return next(new AppError("You cannot follow yourself", 400));
    }

    // Check if already following
    const existingFollow = await VendorFollower.findOne({
      where: {
        user_id: userId,
        vendor_id: vendorId,
      },
    });

    if (existingFollow) {
      return next(new AppError("You are already following this vendor", 400));
    }

    // Create follow relationship
    await VendorFollower.create({
      user_id: userId,
      vendor_id: vendorId,
    });

    res.status(201).json({
      status: "success",
      message: "Successfully followed vendor",
    });
  } catch (error) {
    logger.error("Follow vendor error:", error);
    next(error);
  }
};

/**
 * Removes the follow relationship between the authenticated user and a vendor.
 * Allows users to unfollow vendors they no longer wish to follow.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.vendorId - Vendor ID to unfollow
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID removing the follow relationship
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming unfollow action
 * @returns {boolean} status - Success status
 * @returns {string} message - Success message
 * @throws {AppError} 400 - When user is not following the vendor
 * @api {delete} /api/v1/vendors/:vendorId/unfollow Unfollow Vendor
 * @private user
 * @example
 * // Request
 * DELETE /api/v1/vendors/123/unfollow
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "message": "Successfully unfollowed vendor"
 * }
 */
const unfollowVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;

    // Check if follow relationship exists
    const follow = await VendorFollower.findOne({
      where: {
        user_id: userId,
        vendor_id: vendorId,
      },
    });

    if (!follow) {
      return next(new AppError("You are not following this vendor", 400));
    }

    // Remove follow relationship
    await follow.destroy();

    res.status(200).json({
      status: "success",
      message: "Successfully unfollowed vendor",
    });
  } catch (error) {
    logger.error("Unfollow vendor error:", error);
    next(error);
  }
};

/**
 * Retrieves a paginated list of users who are following a specific vendor.
 * Shows follower information including profile details for vendor relationship management.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.vendorId - Vendor ID to get followers for
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of followers per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor followers
 * @returns {boolean} status - Success status
 * @returns {number} results - Number of followers in current page
 * @returns {number} total - Total number of followers
 * @returns {Array} data - Array of follower objects
 * @returns {number} data[].user_id - Follower user ID
 * @returns {number} data[].vendor_id - Vendor being followed
 * @returns {Object} data[].follower - Follower user details
 * @returns {string} data[].follower.first_name - Follower's first name
 * @returns {string} data[].follower.last_name - Follower's last name
 * @returns {string} data[].follower.email - Follower's email
 * @returns {string} data[].follower.profile_image - Follower's profile image
 * @throws {AppError} 404 - When vendor not found
 * @api {get} /api/v1/vendors/:vendorId/followers Get Vendor Followers
 * @private vendor
 * @example
 * // Request
 * GET /api/v1/vendors/123/followers?page=1&limit=10
 * Authorization: Bearer <vendor_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "results": 5,
 *   "total": 25,
 *   "data": [
 *     {
 *       "user_id": 456,
 *       "vendor_id": 123,
 *       "follower": {
 *         "id": 456,
 *         "first_name": "Jane",
 *         "last_name": "Smith",
 *         "email": "jane.smith@example.com",
 *         "profile_image": "https://example.com/profile.jpg"
 *       }
 *     }
 *   ]
 * }
 */
const getVendorFollowers = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    // Check if vendor exists
    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const { count, rows: followers } = await VendorFollower.findAndCountAll({
      where: { vendor_id: vendorId },
      include: [
        {
          model: User,
          as: "follower",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "profile_image",
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      results: followers.length,
      total: count,
      data: followers,
    });
  } catch (error) {
    logger.error("Get vendor followers error:", error);
    next(error);
  }
};

/**
 * Retrieves a paginated list of vendors that a specific user is following.
 * Shows vendor and store information for each followed vendor.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} [req.params.userId] - User ID (defaults to authenticated user)
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - Authenticated user ID (fallback for userId)
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of vendors per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with followed vendors
 * @returns {boolean} status - Success status
 * @returns {number} results - Number of vendors in current page
 * @returns {number} total - Total number of followed vendors
 * @returns {Array} data - Array of following relationships
 * @returns {Object} data[].vendor - Vendor information
 * @returns {Object} data[].vendor.User - Vendor user details
 * @returns {Object} data[].vendor.store - Vendor store details
 * @api {get} /api/v1/vendors/user/:userId/following Get User Following
 * @private user
 * @example
 * // Request
 * GET /api/v1/vendors/user/456/following?page=1&limit=10
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "results": 3,
 *   "total": 8,
 * "data": [
 *     {
 *       "user_id": 456,
 *       "vendor_id": 123,
 *       "vendor": {
 *         "id": 123,
 *         "User": {
 *           "id": 1,
 *           "first_name": "John",
 *           "last_name": "Doe"
 *         },
 *         "store": {
 *           "business_name": "Doe Enterprises",
 *           "slug": "doe-enterprises",
 *           "logo": "https://example.com/logo.jpg"
 *         }
 *       }
 *     }
 *   ]
 * }
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
          as: "vendor",
          include: [
            {
              model: User,
              as: "User",
              attributes: ["id", "first_name", "last_name", "profile_image"],
            },
            {
              model: Store,
              as: "store",
              attributes: ["business_name", "slug", "logo"],
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      results: following.length,
      total: count,
      data: following,
    });
  } catch (error) {
    logger.error("Get user following error:", error);
    next(error);
  }
};

/**
 * Checks whether the authenticated user is currently following a specific vendor.
 * Returns a boolean indicating the follow relationship status.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.vendorId - Vendor ID to check follow status for
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID to check follow relationship
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with follow status
 * @returns {boolean} status - Success status
 * @returns {Object} data - Follow status information
 * @returns {boolean} data.isFollowing - Whether user is following the vendor
 * @api {get} /api/v1/vendors/:vendorId/follow-status Check Follow Status
 * @private user
 * @example
 * // Request
 * GET /api/v1/vendors/123/follow-status
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "data": {
 *     "isFollowing": true
 *   }
 * }
 */
const checkFollowStatus = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;

    const follow = await VendorFollower.findOne({
      where: {
        user_id: userId,
        vendor_id: vendorId,
      },
    });

    res.status(200).json({
      status: "success",
      data: {
        isFollowing: !!follow,
      },
    });
  } catch (error) {
    logger.error("Check follow status error:", error);
    next(error);
  }
};

/**
 * Retrieves a paginated list of followers for the authenticated vendor.
 * Shows detailed information about users following the vendor's store.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.user - Authenticated vendor user info
 * @param {number} req.user.id - Vendor user ID
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of followers per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor's followers
 * @returns {boolean} status - Success status
 * @returns {number} results - Number of followers in current page
 * @returns {number} total - Total number of followers
 * @returns {Object} data - Response data container
 * @returns {Object} data.vendor - Vendor basic information
 * @returns {number} data.vendor.id - Vendor ID
 * @returns {string} data.vendor.business_name - Vendor business name
 * @returns {Array} data.followers - Array of follower relationships
 * @returns {number} data.followers[].user_id - Follower user ID
 * @returns {number} data.followers[].vendor_id - Vendor ID
 * @returns {Object} data.followers[].follower - Follower user details
 * @throws {AppError} 404 - When vendor profile not found
 * @api {get} /api/v1/vendors/profile/followers Get My Followers
 * @private vendor
 * @example
 * // Request
 * GET /api/v1/vendors/profile/followers?page=1&limit=10
 * Authorization: Bearer <vendor_token>
 *
 * // Success Response (200)
 * {
 *   "status": "success",
 *   "results": 5,
 *   "total": 25,
 *   "data": {
 *     "vendor": {
 *       "id": 123,
 *       "business_name": "Doe Enterprises"
 *     },
 *     "followers": [
 *       {
 *         "user_id": 456,
 *         "vendor_id": 123,
 *         "follower": {
 *           "id": 456,
 *           "first_name": "Jane",
 *           "last_name": "Smith",
 *           "email": "jane.smith@example.com",
 *           "profile_image": "https://example.com/profile.jpg",
 *           "created_at": "2024-08-15T10:30:00.000Z"
 *         }
 *       }
 *     ]
 *   }
 * }
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
          as: "store",
          attributes: ["business_name"],
        },
      ],
    });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { count, rows: followers } = await VendorFollower.findAndCountAll({
      where: { vendor_id: vendor.id },
      include: [
        {
          model: User,
          as: "follower",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "profile_image",
            "created_at",
          ],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      results: followers.length,
      total: count,
      data: {
        vendor: {
          id: vendor.id,
          business_name: vendor.store.business_name,
        },
        followers: followers,
      },
    });
  } catch (error) {
    logger.error("Get my followers error:", error);
    next(error);
  }
};

module.exports = {
  registerVendor,
  getVendorProfile,
  completeOnboarding,
  getVendorProducts,
  getAllVendors,
  getVendor,
  approveVendor,
  rejectVendor,
  followVendor,
  unfollowVendor,
  getVendorFollowers,
  getUserFollowing,
  checkFollowStatus,
  getMyFollowers,
};
