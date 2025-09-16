const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require('passport');
const { User, Role } = require("../models");
const AppError = require("../utils/appError");
const { sendWelcomeEmail } = require("../services/email.service");
const logger = require("../utils/logger");

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

// Generate JWT token
const signToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "90d",
    algorithm: "HS256", // Explicitly specify the algorithm
    issuer: process.env.APP_NAME || "Stylay",
    audience: "user",
  });
};

// Create and send token
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: user,
  });
};

// Register a new user
exports.register = async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, phone, gender } = req.body;

    // Check if user already exists with the same email or phone
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { phone: phone }
        ]
      },
      attributes: ['email', 'phone'] // Only fetch necessary fields for the check
    });
    
    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return next(new AppError("This email is already registered. Please use a different email or try logging in.", 400, {
          code: 'EMAIL_EXISTS',
          field: 'email'
        }));
      }
      if (existingUser.phone === phone) {
        return next(new AppError("This phone number is already in use. Please use a different number.", 400, {
          code: 'PHONE_EXISTS',
          field: 'phone'
        }));
      }
    }

    // Generate and store verification code with expiration
    const { code: verificationCode, expires: tokenExpires } = generateVerificationCode();
    const hashedCode = hashVerificationCode(verificationCode);
    // Create new user (initially inactive)
    const newUser = await User.create({
      first_name,
      last_name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 12),
      phone,
      gender,
      is_active: false, // User needs to verify email first
      email_verified_at: null,
      email_verification_token: hashedCode,
      email_verification_token_expires: tokenExpires,
    });
    

    // Assign default role (customer)
    const customerRole = await Role.findOne({ where: { name: "customer" } });
    if (customerRole) {
      await newUser.addRole(customerRole, { 
        through: { 
          created_at: new Date(),
        } 
      });
    }

    // Calculate minutes until expiration
    const minutesUntilExpiry = Math.ceil((tokenExpires - new Date()) / (1000 * 60));
    
    // Send welcome email with verification code
    try {
      await sendWelcomeEmail(
        newUser.email,
        `${newUser.first_name} ${newUser.last_name}`,
        verificationCode,
        minutesUntilExpiry
      );
    } catch (err) {
      logger.error(`Error sending welcome email: ${err.message}`);
      // Don't fail the registration if email sending fails
    }

    createSendToken(newUser, 201, res);
  } catch (err) {
    next(err);
  }
};

// Verify email with code
exports.verifyEmail = async (req, res, next) => {
  const { email, code } = req.body;

  // Validate input
  if (!email || !code) {
    return next(new AppError("Email and verification code are required", 400));
  }

  let transaction;
  
  try {
    // Start a transaction
    transaction = await User.sequelize.transaction();

    // Find the user by email
    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: Role,
          as: "roles",
          attributes: ["name"],
          through: { attributes: [] },
        },
      ],
      transaction,
      lock: true // Lock the row to prevent concurrent updates
    });

    if (!user) {
      if (transaction) await transaction.rollback();
      return next(new AppError("No user found with this email", 404));
    }

    // Check if user is already verified
    if (user.email_verified_at) {
      if (transaction) await transaction.rollback();
      return res.status(200).json({
        status: "success",
        message: "Email is already verified",
        data: {
          user: {
            id: user.id,
            email: user.email,
            is_verified: true,
          },
        },
      });
    }

    // Check token status
    const tokenStatus = user.getTokenStatus();
    if (tokenStatus.isExpired) {
      if (transaction) await transaction.rollback();
      return next(new AppError(tokenStatus.message, 400, {
        code: 'TOKEN_EXPIRED',
        expiresAt: tokenStatus.expiresAt,
        isExpired: true
      }));
    }

    // Verify the verification code
    const isCodeValid = await bcrypt.compare(
      code,
      user.email_verification_token
    );
    
    if (!isCodeValid) {
      if (transaction) await transaction.rollback();
      return next(new AppError("Invalid or expired verification code", 400, {
        code: 'INVALID_CODE',
        message: 'The verification code is invalid or has expired.'
      }));
    }

    // Update user as verified, active, and clear verification token
    await user.update(
      {
        email_verification_token: null,
        email_verification_token_expires: null,
        email_verified_at: new Date(),
        is_active: true,
      },
      { transaction }
    );

    // Commit the transaction
    await transaction.commit();

    // Generate JWT token
    const token = signToken(user.id);

    // Remove sensitive data from output
    user.password = undefined;

    // Log successful verification
    logger.info(`User ${user.id} email verified successfully`);

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      token,
      data: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        is_verified: true,
        role: user.role ? user.role.name : "customer",
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    // Rollback transaction in case of error
    try {
      if (transaction && typeof transaction.rollback === 'function' && 
          transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      logger.error(`Error during transaction rollback: ${rollbackError.message}`, { error: rollbackError });
    }

    logger.error(`Error verifying email: ${error.message}`, { 
      error: error.message,
      stack: error.stack,
      email: email
    });
    
    return next(
      new AppError(
        "An error occurred while verifying your email. Please try again.",
        500,
        { code: 'VERIFICATION_ERROR' }
      )
    );
  }
};

// Login user with Passport local strategy
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError("Please provide email and password!", 400));
    }

    // 2) Use Passport's local strategy for authentication
    passport.authenticate('local', { session: false }, async (err, user, info) => {
      try {
        if (err) {
          return next(err);
        }

        if (!user) {
          return next(new AppError(info?.message || 'Authentication failed', 401));
        }

        // 3) Check if email is verified
        if (!user.email_verified_at) {
          return next(new AppError("Please verify your email address first", 401));
        }

        // 4) Send token to client
        createSendToken(user, 200, res);
      } catch (err) {
        next(err);
      }
    })(req, res, next);
  } catch (err) {
    next(err);
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { id } = req.user;
    const updateData = { ...req.body };
    
    // Remove fields that shouldn't be updated this way
    const restrictedFields = ['password', 'password_reset_token', 'password_reset_expires', 'email_verified_at', 'email_verification_token'];
    restrictedFields.forEach(field => delete updateData[field]);
    
    // If email is being updated, mark it as unverified
    if (updateData.email && updateData.email !== req.user.email) {
      updateData.email_verified_at = null;
      updateData.email_verification_token = generateVerificationCode().code;
      // TODO: Send verification email
    }
    
    // Update user in database
    const [updated] = await User.update(updateData, {
      where: { id },
      returning: true,
      individualHooks: true
    });
    
    if (!updated) {
      return next(new AppError('No user found with that ID', 404));
    }
    
    // Fetch the updated user
    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['password', 'password_reset_token', 'password_reset_expires'] },
      include: [
        {
          model: Role,
          as: 'roles',
          attributes: ['id', 'name'],
          through: { attributes: [] }
        }
      ]
    });
    
    // Log the profile update
    logger.info(`User profile updated: ${updatedUser.email} (ID: ${updatedUser.id})`);
    
    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
    
  } catch (error) {
    logger.error(`Error updating user profile: ${error.message}`, {
      userId: req.user?.id,
      error: error.stack
    });
    next(error);
  }
};

// Get current user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["id", "name", "description"],
        },
      ],
    });

    res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Rate limiting configuration (in milliseconds)
const VERIFICATION_RESEND_DELAY = 30 * 1000; // 30 seconds

exports.resendVerificationCode = async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(new AppError('Email is required', 400));
  }
  
  let transaction;
  
  try {
    // Start transaction
    
    // Find user by email with lock to prevent race conditions
    const user = await User.findOne({ 
      where: { email },
    });

    if (!user) {
      return next(new AppError('No account found with this email', 404));
    }

    // Check if email is already verified
    if (user.email_verified_at) {
      return next(new AppError('Email is already verified', 400));
    }

    // Check rate limiting
    const now = new Date();
    if (user.email_verification_token_expires) {
      const timeSinceLastSent = now - user.email_verification_token_expires.getTime() + (10 * 60 * 1000);
      const timeRemaining = Math.ceil((VERIFICATION_RESEND_DELAY - timeSinceLastSent) / 1000);
      
      if (timeSinceLastSent < VERIFICATION_RESEND_DELAY) {
        return next(new AppError(
          `Please wait ${timeRemaining} seconds before requesting a new code`,
          429, // Too Many Requests
          { code: 'RATE_LIMIT_EXCEEDED', retryAfter: timeRemaining }
        ));
      }
    }

    // Generate new verification code with expiration
    const { code: verificationCode, expires: tokenExpires } = generateVerificationCode();
    const hashedCode = hashVerificationCode(verificationCode);

    try {
      // Update user with new verification token and expiration
      await user.update({
        email_verification_token: hashedCode,
        email_verification_token_expires: tokenExpires,
        updated_at: now
      });

      // Calculate minutes until expiration
      const minutesUntilExpiry = Math.ceil((tokenExpires - now) / (1000 * 60));
      
      // Send welcome email with new verification code
      try {
        await sendWelcomeEmail(
          user.email,
          `${user.first_name} ${user.last_name}`,
          verificationCode, 
          minutesUntilExpiry
        );
      } catch (err) {
        logger.error(`Error sending verification email to ${user.email}:`, err);
        // Don't fail the request if email sending fails, just log it
      }

      return res.status(200).json({
        status: "success",
        message: `Verification code sent to ${email}`,
        expiresIn: minutesUntilExpiry * 60, // in seconds for consistency
        expiresAt: tokenExpires
      });
    } catch (updateErr) {
      throw updateErr; // Let the outer catch handle it
    }
  } catch (err) {
    
    // Log the error for debugging
    logger.error('Error in resendVerificationCode:', err);
    
    // Handle specific error cases
    if (err.name === 'SequelizeDatabaseError') {
      return next(new AppError('A database error occurred', 500));
    }
    
    // Pass to the global error handler
    next(err);
  }
};

// Update password
exports.updatePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  try {
    // 1) Get user from collection
    const user = await User.findByPk(req.user.id);

    // 2) Check if POSTed current password is correct
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return next(new AppError("Your current password is wrong.", 401));
    }

    // 3) If so, update password
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// Forgot password - Send reset code
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Email is required", 400));
  }

  const transaction = await User.sequelize.transaction();

  try {
    // 1) Get user based on POSTed email
    const user = await User.findOne({
      where: { email },
      transaction,
    });

    // Return success even if user doesn't exist to prevent email enumeration
    if (!user) {
      await transaction.commit();
      return res.status(200).json({
        status: "success",
        message:
          "If your email is registered, you will receive a password reset code.",
      });
    }

    // 2) Invalidate any existing password reset codes for this user

    // 3) Generate a new 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = hashVerificationCode(resetCode);

    // 4) Save the verification code to the database
    await user.update({
      password_reset_token: hashedCode,
    });

    // 5) Send the reset code to the user's email
    await sendPasswordResetEmail(
      user.email,
      `${user.first_name} ${user.last_name}`,
      resetCode
    );

    // Commit the transaction
    await transaction.commit();

    // Log the successful password reset request
    logger.info(`Password reset code sent to user ${user.id}`);

    res.status(200).json({
      status: "success",
      message:
        "If your email is registered, you will receive a password reset code.",
    });
  } catch (err) {
    // Rollback transaction in case of error
    if (
      transaction.finished !== "commit" &&
      transaction.finished !== "rollback"
    ) {
      await transaction.rollback();
    }

    logger.error(`Error in forgotPassword for ${email}: ${err.message}`, {
      error: err,
    });
    next(
      new AppError(
        "An error occurred while processing your request. Please try again later.",
        500
      )
    );
  }
};

// Logout user
exports.logout = (req, res) => {
  try {
    // Clear the JWT cookie if it exists
    if (req.cookies?.jwt) {
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
    }

    // If using token-based auth, the client should remove the token
    res.status(200).json({
      status: "success",
      message: "Successfully logged out",
    });
  } catch (err) {
    // Even if there's an error, we still want to return a success response
    // to prevent the user from being stuck in a logged-in state
    res.status(200).json({
      status: "success",
      message: "Successfully logged out",
    });
  }
};

// Reset password with code
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return next(
        new AppError("Email, code and new password are required", 400)
      );
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Find and validate reset code
    const isCodeValid = await bcrypt.compare(code, user.password_reset_token);
    if (!isCodeValid) {
      return next(new AppError("Invalid or expired reset code", 400));
    }

    // Mark code as used
    await user.update({ password_reset_token: null });

    // Update password
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
    });
  } catch (err) {
    next(err);
  }
};
