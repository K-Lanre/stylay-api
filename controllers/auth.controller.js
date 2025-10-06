const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require('passport');
const { User, Role} = require("../models");
const { Op } = require("sequelize");
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

/**
 * Register a new user account
 * Creates a new user with email verification required before account activation.
 * Sends a welcome email with verification code that expires in 10 minutes.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.first_name - User's first name (required)
 * @param {string} req.body.last_name - User's last name (required)
 * @param {string} req.body.email - User's email address (required, must be unique)
 * @param {string} req.body.password - User's password (required, min 8 characters)
 * @param {string} req.body.phone - User's phone number (required, must be unique, Nigerian format)
 * @param {string} req.body.gender - User's gender (optional)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with JWT token and user data
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.token - JWT authentication token
 * @returns {Object} res.body.data - User data object
 * @throws {AppError} 400 - Email already registered or phone already in use
 * @throws {AppError} 500 - Server error during registration
 * @api {post} /api/v1/auth/register Register a new user
 * @example
 * POST /api/v1/auth/register
 * {
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "email": "john.doe@example.com",
 *   "password": "securepass123",
 *   "phone": "+2348012345678",
 *   "gender": "male"
 * }
 */
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

/**
 * Verify user email using verification code
 * Validates the email verification code sent during registration and activates the user account.
 * Uses database transactions for data consistency.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.email - User's email address (required)
 * @param {string} req.body.code - 6-digit verification code (required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with JWT token and verified user data
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Success message
 * @returns {string} res.body.token - JWT authentication token
 * @returns {Object} res.body.data - Verified user data with roles
 * @throws {AppError} 400 - Missing email/code, invalid/expired code, or already verified
 * @throws {AppError} 404 - User not found
 * @throws {AppError} 500 - Server error during verification
 * @api {post} /api/v1/auth/verify-email Verify email with code
 * @example
 * POST /api/v1/auth/verify-email
 * {
 *   "email": "john.doe@example.com",
 *   "code": "123456"
 * }
 */
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

/**
 * Authenticate user login using Passport local strategy
 * Validates user credentials and returns JWT token if authentication successful.
 * Requires email verification before allowing login.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.email - User's email address (required)
 * @param {string} req.body.password - User's password (required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with JWT token and user data
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.token - JWT authentication token
 * @returns {Object} res.body.data - User data object
 * @throws {AppError} 400 - Missing email or password
 * @throws {AppError} 401 - Invalid credentials or unverified email
 * @throws {AppError} 500 - Authentication error
 * @api {post} /api/v1/auth/login Login user with Passport local strategy
 * @example
 * POST /api/v1/auth/login
 * {
 *   "email": "john.doe@example.com",
 *   "password": "securepass123"
 * }
 */
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

/**
 * Update authenticated user's profile information
 * Allows users to modify their profile data while preventing updates to sensitive fields.
 * If email is changed, marks it as unverified and triggers re-verification process.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.body} req.body - Request body with updatable fields
 * @param {string} [req.body.first_name] - User's first name
 * @param {string} [req.body.last_name] - User's last name
 * @param {string} [req.body.email] - New email address (triggers verification)
 * @param {string} [req.body.phone] - Phone number
 * @param {string} [req.body.gender] - Gender
 * @param {Date} [req.body.dob] - Date of birth
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated user data
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - Updated user object with roles
 * @throws {AppError} 404 - User not found
 * @throws {AppError} 500 - Server error during update
 * @api {put} /api/v1/auth/update-profile Update user profile
 * @private Requires authentication
 * @example
 * PUT /api/v1/auth/update-profile
 * Authorization: Bearer <jwt_token>
 * {
 *   "first_name": "John",
 *   "last_name": "Smith",
 *   "phone": "+2348012345678"
 * }
 */
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

/**
 * Get current authenticated user's profile data
 * Returns comprehensive user information including roles and permissions.
 * Excludes sensitive data like passwords.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with current user data
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - User object with roles and permissions
 * @throws {AppError} 500 - Server error retrieving user data
 * @api {get} /api/v1/auth/me Get current user
 * @private Requires authentication
 * @example
 * GET /api/v1/auth/me
 * Authorization: Bearer <jwt_token>
 */
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

/**
 * Resend email verification code
 * Generates and sends a new verification code with rate limiting (30 seconds between requests).
 * Updates the verification token and expiration time in the database.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.email - User's email address (required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with expiration details
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Success message
 * @returns {number} res.body.expiresIn - Token expiration in seconds
 * @returns {Date} res.body.expiresAt - Token expiration timestamp
 * @throws {AppError} 400 - Email required or already verified
 * @throws {AppError} 404 - User not found
 * @throws {AppError} 429 - Rate limit exceeded (wait before retrying)
 * @throws {AppError} 500 - Server error sending email
 * @api {post} /api/v1/auth/resend-verification-code Resend verification code
 * @example
 * POST /api/v1/auth/resend-verification-code
 * {
 *   "email": "john.doe@example.com"
 * }
 */
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

/**
 * Update authenticated user's password
 * Validates current password before allowing password change.
 * Updates password_changed_at timestamp and logs the change.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.currentPassword - User's current password (required)
 * @param {string} req.body.newPassword - New password (required, min 8 characters)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with new JWT token
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.token - New JWT authentication token
 * @returns {Object} res.body.data - Updated user data
 * @throws {AppError} 400 - Phone change pending (blocks password update)
 * @throws {AppError} 401 - Current password is incorrect
 * @throws {AppError} 500 - Server error during password update
 * @api {put} /api/v1/auth/update-password Update password
 * @private Requires authentication
 * @example
 * PUT /api/v1/auth/update-password
 * Authorization: Bearer <jwt_token>
 * {
 *   "currentPassword": "oldpassword123",
 *   "newPassword": "newpassword456"
 * }
 */
exports.updatePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  try {
    // 1) Get user from collection
    const user = await User.findByPk(req.user.id);

    // 2) Check if phone change is pending verification
    if (user.isPhoneChangePending() && !user.isPhoneChangeVerificationExpired()) {
      return next(new AppError("You cannot change your password while a phone number change is pending verification. Please wait for admin approval or cancel the phone change request.", 400));
    }

    // 3) Check if POSTed current password is correct
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return next(new AppError("Your current password is wrong.", 401));
    }

    // 4) If so, update password
    user.password = await bcrypt.hash(newPassword, 12);
    user.password_changed_at = new Date();
    await user.save();

    // 5) Log user in, send JWT
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

/**
 * Initiate password reset process
 * Generates a reset code and sends it via email. Returns success even if email doesn't exist
 * to prevent email enumeration attacks. Uses database transactions for consistency.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.email - User's email address (required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response (generic message for security)
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Generic success message
 * @throws {AppError} 400 - Email required
 * @throws {AppError} 500 - Server error or email sending failure
 * @api {post} /api/v1/auth/forgot-password Forgot password - Send reset code
 * @example
 * POST /api/v1/auth/forgot-password
 * {
 *   "email": "john.doe@example.com"
 * }
 */
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

/**
 * Logout user by clearing authentication cookies
 * Clears JWT cookies on the client side. For token-based auth, client removes token.
 * Always returns success to prevent user being stuck in logged-in state.
 *
 * @param {import('express').Request} req - Express request object (may include JWT cookie)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming logout
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Logout confirmation message
 * @api {post} /api/v1/auth/logout Logout user
 * @example
 * POST /api/v1/auth/logout
 * Authorization: Bearer <jwt_token> (optional)
 */
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

/**
 * Reset user password using reset code
 * Validates the reset code and updates the user's password.
 * Marks the reset token as used to prevent reuse.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.email - User's email address (required)
 * @param {string} req.body.code - 6-digit reset code (required)
 * @param {string} req.body.newPassword - New password (required, min 8 characters)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming password update
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Password update confirmation
 * @throws {AppError} 400 - Missing required fields or invalid/expired code
 * @throws {AppError} 404 - User not found
 * @throws {AppError} 500 - Server error during password reset
 * @api {post} /api/v1/auth/reset-password Reset password with code
 * @example
 * POST /api/v1/auth/reset-password
 * {
 *   "email": "john.doe@example.com",
 *   "code": "654321",
 *   "newPassword": "newsecurepass123"
 * }
 */
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

/**
 * Request phone number change for authenticated user
 * Initiates phone change process requiring admin approval. Sends verification email to user.
 * Generates secure token valid for 24 hours. Validates Nigerian phone format.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.newPhone - New phone number in Nigerian format (required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with pending change details
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Request submission confirmation
 * @returns {Object} res.body.data - Pending change details
 * @returns {string} res.body.data.pending_phone - Requested phone number
 * @returns {Date} res.body.data.requested_at - Request timestamp
 * @returns {Date} res.body.data.verification_expires_at - Token expiry
 * @throws {AppError} 400 - Invalid phone format, phone in use, or pending request exists
 * @throws {AppError} 500 - Server error during request processing
 * @api {post} /api/v1/auth/request-phone-change Request phone number change
 * @private Requires authentication
 * @example
 * POST /api/v1/auth/request-phone-change
 * Authorization: Bearer <jwt_token>
 * {
 *   "newPhone": "+2348012345678"
 * }
 */
exports.requestPhoneChange = async (req, res, next) => {
  try {
    const { newPhone } = req.body;
    const userId = req.user.id;

    if (!newPhone) {
      return next(new AppError("New phone number is required", 400));
    }

    // Validate phone format
    const phoneRegex = /^\+234(70|80|81|90|91)[0-9]{8}$/;
    if (!phoneRegex.test(newPhone)) {
      return next(new AppError("Phone number must be in the format +234[70|80|81|90|91]XXXXXXXX (e.g., +2348012345678)", 400));
    }

    const user = await User.findByPk(userId);

    // Check if phone is already in use
    const existingUser = await User.findOne({ where: { phone: newPhone } });
    if (existingUser && existingUser.id !== userId) {
      return next(new AppError("This phone number is already in use", 400));
    }

    // Check if user already has a pending phone change
    if (user.isPhoneChangePending() && !user.isPhoneChangeVerificationExpired()) {
      return next(new AppError("You already have a pending phone change request. Please wait for admin approval or cancel the current request.", 400));
    }

    // Generate verification token (24 hours expiry)
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24);

    // Update user with pending phone change
    await user.update({
      pending_phone_number: newPhone,
      phone_change_requested_at: new Date(),
      phone_change_token: token,
      phone_change_token_expires: tokenExpires
    });

    // TODO: Send admin notification
    // For now, we'll log it
    logger.info(`Phone change requested by user ${userId}: ${user.phone} -> ${newPhone}`);

    // Send user notification email
    try {
      await sendPhoneChangeNotificationEmail(
        user.email,
        `${user.first_name} ${user.last_name}`,
        newPhone,
        token
      );
    } catch (emailErr) {
      logger.error(`Error sending phone change notification email: ${emailErr.message}`);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      status: "success",
      message: "Phone change request submitted successfully. Please check your email for verification instructions.",
      data: {
        pending_phone: newPhone,
        requested_at: user.phone_change_requested_at,
        verification_expires_at: tokenExpires
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify phone change request via email link
 * Validates the verification token and marks the request as verified for admin approval.
 * Clears the verification token after successful verification.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.token - Verification token from email link (required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming verification
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Verification confirmation
 * @returns {Object} res.body.data - Verified request details
 * @returns {string} res.body.data.pending_phone - Requested phone number
 * @returns {Date} res.body.data.requested_at - Request timestamp
 * @throws {AppError} 400 - Invalid/expired token or verification period expired
 * @throws {AppError} 500 - Server error during verification
 * @api {get} /api/v1/auth/verify-phone-change Verify phone change (user clicks verification link)
 * @example
 * GET /api/v1/auth/verify-phone-change?token=abc123def456
 */
exports.verifyPhoneChange = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return next(new AppError("Verification token is required", 400));
    }

    const user = await User.findOne({
      where: {
        phone_change_token: token
      }
    });

    if (!user) {
      return next(new AppError("Invalid verification token", 400));
    }

    // Check if token is expired
    const tokenStatus = user.getPhoneChangeTokenStatus();
    if (tokenStatus.isExpired) {
      return next(new AppError(tokenStatus.message, 400));
    }

    // Check if verification period has expired
    if (user.isPhoneChangeVerificationExpired()) {
      return next(new AppError("Phone change verification period has expired. Please submit a new request.", 400));
    }

    // Clear the verification token but keep pending phone for admin approval
    await user.update({
      phone_change_token: null,
      phone_change_token_expires: null
    });

    res.status(200).json({
      status: "success",
      message: "Phone change request verified successfully. Your request is now pending admin approval.",
      data: {
        pending_phone: user.pending_phone_number,
        requested_at: user.phone_change_requested_at
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel pending phone change request
 * Removes all pending phone change data for the authenticated user.
 * Allows user to submit a new phone change request after cancellation.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming cancellation
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Cancellation confirmation
 * @throws {AppError} 400 - No pending request found
 * @throws {AppError} 500 - Server error during cancellation
 * @api {post} /api/v1/auth/cancel-phone-change Cancel phone change request (user)
 * @private Requires authentication
 * @example
 * POST /api/v1/auth/cancel-phone-change
 * Authorization: Bearer <jwt_token>
 */
exports.cancelPhoneChange = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId);

    if (!user.isPhoneChangePending()) {
      return next(new AppError("No pending phone change request found", 400));
    }

    // Clear pending phone change
    await user.update({
      pending_phone_number: null,
      phone_change_requested_at: null,
      phone_change_token: null,
      phone_change_token_expires: null
    });

    res.status(200).json({
      status: "success",
      message: "Phone change request cancelled successfully"
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin approval of phone number change request
 * Validates request is still pending and phone number available, then updates user's phone.
 * Clears all pending change fields after successful approval.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.userId - ID of user whose request to approve (required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with approval details
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Approval confirmation
 * @returns {Object} res.body.data - Approval result details
 * @returns {string} res.body.data.user_id - Approved user ID
 * @returns {string} res.body.data.new_phone - New phone number
 * @throws {AppError} 400 - No pending request, verification expired, or phone unavailable
 * @throws {AppError} 404 - User not found
 * @throws {AppError} 500 - Server error during approval
 * @api {post} /api/v1/auth/approve-phone-change Admin approve phone change
 * @private Requires admin authentication
 * @example
 * POST /api/v1/auth/approve-phone-change/123
 * Authorization: Bearer <admin_jwt_token>
 */
exports.approvePhoneChange = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!user.isPhoneChangePending()) {
      return next(new AppError("No pending phone change request for this user", 400));
    }

    if (user.isPhoneChangeVerificationExpired()) {
      return next(new AppError("Phone change verification period has expired", 400));
    }

    // Check if new phone is still available
    const existingUser = await User.findOne({
      where: { phone: user.pending_phone_number }
    });
    if (existingUser && existingUser.id !== userId) {
      return next(new AppError("The requested phone number is no longer available", 400));
    }

    // Update phone number and clear pending fields
    await user.update({
      phone: user.pending_phone_number,
      pending_phone_number: null,
      phone_change_requested_at: null,
      phone_change_token: null,
      phone_change_token_expires: null
    });

    // Log the approval
    logger.info(`Phone change approved for user ${userId}: ${user.phone}`);

    res.status(200).json({
      status: "success",
      message: "Phone change approved successfully",
      data: {
        user_id: userId,
        new_phone: user.phone
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin rejection of phone number change request
 * Removes pending phone change request without updating user's phone number.
 * Logs the rejection for audit purposes.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.userId - ID of user whose request to reject (required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with rejection details
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {string} res.body.message - Rejection confirmation
 * @returns {Object} res.body.data - Rejection result details
 * @returns {string} res.body.data.user_id - Rejected user ID
 * @throws {AppError} 400 - No pending request found
 * @throws {AppError} 404 - User not found
 * @throws {AppError} 500 - Server error during rejection
 * @private admin
 * @api {post} /api/v1/auth/reject-phone-change Admin reject phone change
 * @example
 * POST /api/v1/auth/reject-phone-change/123
 * Authorization: Bearer <admin_jwt_token>
 */
exports.rejectPhoneChange = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!user.isPhoneChangePending()) {
      return next(new AppError("No pending phone change request for this user", 400));
    }

    // Clear pending phone change
    await user.update({
      pending_phone_number: null,
      phone_change_requested_at: null,
      phone_change_token: null,
      phone_change_token_expires: null
    });

    // Log the rejection
    logger.info(`Phone change rejected for user ${userId}`);

    res.status(200).json({
      status: "success",
      message: "Phone change request rejected",
      data: {
        user_id: userId
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get paginated list of pending phone change requests (admin only)
 * Returns all users with pending phone change requests for admin review and approval.
 * Includes pagination support for large result sets.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.query} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of results per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Paginated list of pending phone change requests
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {number} res.body.results - Number of results in current page
 * @returns {number} res.body.total - Total number of pending requests
 * @returns {number} res.body.totalPages - Total number of pages
 * @returns {number} res.body.currentPage - Current page number
 * @returns {Array} res.body.data - Array of pending phone change user objects
 * @throws {AppError} 500 - Server error retrieving pending requests
 * @private admin
 * @api {get} /api/v1/auth/get-pending-phone-changes Get pending phone changes (admin)
 * @example
 * GET /api/v1/auth/get-pending-phone-changes?page=1&limit=5
 * Authorization: Bearer <admin_jwt_token>
 */
exports.getPendingPhoneChanges = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      where: {
        pending_phone_number: { [require('sequelize').Op.ne]: null },
        phone_change_requested_at: { [require('sequelize').Op.ne]: null }
      },
      attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'pending_phone_number', 'phone_change_requested_at'],
      limit,
      offset,
      order: [['phone_change_requested_at', 'ASC']]
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: users
    });
  } catch (err) {
    next(err);
  }
};
