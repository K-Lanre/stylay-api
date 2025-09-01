const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Role } = require('../models');
const AppError = require('../utils/appError');
const { sendWelcomeEmail } = require('../services/email.service');
const logger = require('../utils/logger');

// Generate a random 6-digit code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hash the verification code
const hashVerificationCode = async (code) => {
  return await bcrypt.hash(code, 10);
};

// Generate JWT token
const signToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '90d',
      algorithm: 'HS256', // Explicitly specify the algorithm
      issuer: process.env.APP_NAME || 'Stylay',
      audience: 'user',
    }
  );
};

// Create and send token
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);
  
  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

// Register a new user
exports.register = async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, phone, gender } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    // Generate and store verification code
    const verificationCode = generateVerificationCode();
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
    });


    // Assign default role (customer)
    const customerRole = await Role.findOne({ where: { name: 'customer' } });
    if (customerRole) {
      await newUser.addRole(customerRole);
    }

    // Send welcome email with verification code
    try {
      await sendWelcomeEmail(
        newUser.email,
        `${newUser.first_name} ${newUser.last_name}`,
        verificationCode
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
    return next(new AppError('Email and verification code are required', 400));
  }

  const transaction = await User.sequelize.transaction();
  
  try {
    // Find the user by email
    const user = await User.findOne({ 
      where: { email },
      include: [
        {
          model: Role,
          as: 'roles',
          attributes: ['name'],
          through: { attributes: [] }, // Exclude junction table attributes
          transaction
        }
      ],
      transaction
    });

    if (!user) {
      await transaction.rollback();
      return next(new AppError('No user found with this email', 404));
    }

    // Check if user is already verified
    if (user.email_verified_at) {
      await transaction.rollback();
      return res.status(200).json({
        status: 'success',
        message: 'Email is already verified',
        data: {
          user: {
            id: user.id,
            email: user.email,
            is_verified: true
          }
        }
      });
    }

    // Find and compare the verification code
    const isCodeValid = await bcrypt.compare(code, user.email_verification_token);
    if (!isCodeValid) {
      await transaction.rollback();
      return next(new AppError('Invalid or expired verification code', 400));
    }

    // Mark the verification code as used
    await user.update({ 
      email_verification_token: null,
      email_verified_at: new Date()
    }, { transaction });

    // Update user as verified and active
    await user.update({ 
      email_verified_at: new Date(),
      is_active: true
    }, { transaction });

    // Commit the transaction
    await transaction.commit();

    // Generate JWT token
    const token = signToken(user.id);

    // Remove sensitive data from output
    user.password = undefined;

    // Log successful verification
    logger.info(`User ${user.id} email verified successfully`);

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully',
      token,
      data: {
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          is_verified: true,
          role: user.role ? user.role.name : 'customer',
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      }
    });
  } catch (error) {
    // Rollback transaction in case of error
    if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
      await transaction.rollback();
    }
    
    logger.error(`Error verifying email: ${error.message}`, { error });
    return next(new AppError('An error occurred while verifying your email. Please try again.', 500));
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }

    // 2) Check if user exists && password is correct
    const user = await User.findOne({ 
      where: { email },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name', 'description']
        }
      ]
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) Check if email is verified
    if (!user.email_verified_at) {
      return next(new AppError('Please verify your email address first', 401));
    }

    // 4) If everything ok, send token to client
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// Get current user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name', 'description']
        }
      ]
    });

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    next(err);
  }
};

// Resend verification code
exports.resendVerificationCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (user.email_verified_at) {
      return next(new AppError('Email already verified', 400));
    }

    // Generate and store new verification code
    const verificationCode = generateVerificationCode();
    const hashedCode = hashVerificationCode(verificationCode);

    await user.update({
      email_verification_token: hashedCode,
    });

    // Send welcome email with new verification code
    try {
      await sendWelcomeEmail(
        user.email,
        `${user.first_name} ${user.last_name}`,
        verificationCode
      );
    } catch (err) {
      logger.error(`Error sending verification email: ${err.message}`);
      return next(new AppError('Error sending verification email', 500));
    }

    res.status(200).json({
      status: 'success',
      message: 'Verification code sent successfully'
    });
  } catch (err) {
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
      return next(new AppError('Your current password is wrong.', 401));
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
    return next(new AppError('Email is required', 400));
  }

  const transaction = await User.sequelize.transaction();
  
  try {
    // 1) Get user based on POSTed email
    const user = await User.findOne({ 
      where: { email },
      transaction
    });
    
    // Return success even if user doesn't exist to prevent email enumeration
    if (!user) {
      await transaction.commit();
      return res.status(200).json({
        status: 'success',
        message: 'If your email is registered, you will receive a password reset code.'
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
      status: 'success',
      message: 'If your email is registered, you will receive a password reset code.'
    });
  } catch (err) {
    // Rollback transaction in case of error
    if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
      await transaction.rollback();
    }
    
    logger.error(`Error in forgotPassword for ${email}: ${err.message}`, { error: err });
    next(new AppError('An error occurred while processing your request. Please try again later.', 500));
  }
};

// Logout user
exports.logout = (req, res) => {
  try {
    // Clear the JWT cookie if it exists
    if (req.cookies?.jwt) {
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });
    }

    // If using token-based auth, the client should remove the token
    res.status(200).json({
      status: 'success',
      message: 'Successfully logged out'
    });
  } catch (err) {
    // Even if there's an error, we still want to return a success response
    // to prevent the user from being stuck in a logged-in state
    res.status(200).json({
      status: 'success',
      message: 'Successfully logged out'
    });
  }
};

// Reset password with code
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return next(new AppError('Email, code and new password are required', 400));
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Find and validate reset code
    const isCodeValid = await bcrypt.compare(code, user.password_reset_token);
    if (!isCodeValid) {
      return next(new AppError('Invalid or expired reset code', 400));
    }

    // Mark code as used
    await user.update({ password_reset_token: null });

    // Update password
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully'
    });
  } catch (err) {
    next(err);
  }
};
