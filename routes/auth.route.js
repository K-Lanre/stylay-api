const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validate } = require('../validators/auth.validator');
const { protect } = require('../middlewares/auth');
const {
  registerValidation,
  loginValidation,
  updatePasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} = require('../validators/auth.validator');

// Public routes
router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/verify-email', verifyEmailValidation, validate, authController.verifyEmail);
router.post('/resend-verification', resendVerificationValidation, validate, authController.resendVerificationCode);
router.post('/forgot-password', forgotPasswordValidation, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, validate, authController.resetPassword);
router.get('/logout', authController.logout);

// Protected routes (require authentication)
router.use(protect);

// Get current user
router.get('/me', authController.getMe);

// Update password
router.patch('/update-password', updatePasswordValidation, validate, authController.updatePassword);

module.exports = router;
