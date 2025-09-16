const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { validate } = require("../validators/auth.validator");
const { protect, localAuth } = require("../middlewares/auth");
const {
  registerValidation,
  loginValidation,
  updatePasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation
} = require("../validators/auth.validator");

// Public routes
router.post("/register", registerValidation, validate, authController.register);

// Login with Passport local strategy
router.post(
  "/login",
  loginValidation,
  validate,
  localAuth(),
  authController.login
);

router.post(
  "/verify-email",
  verifyEmailValidation,
  validate,
  authController.verifyEmail
);
router.post(
  "/resend-verification",
  resendVerificationValidation,
  validate,
  authController.resendVerificationCode
);
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  validate,
  authController.forgotPassword
);
router.post(
  "/reset-password",
  resetPasswordValidation,
  validate,
  authController.resetPassword
);
router.get("/logout", authController.logout);

// Protected routes (require authentication)
router.use(protect);

// Get current user
router.get("/me", authController.getMe);

// Update password
router.patch(
  "/update-password",
  updatePasswordValidation,
  validate,
  authController.updatePassword
);

// Protected routes (require authentication)
router.use(protect);

// Update user profile
router.put(
  '/me',
  updateProfileValidation,
  validate,
  authController.updateProfile
);

// Get current user
router.get('/me', authController.getMe);

// Update password
router.put(
  '/update-password',
  updatePasswordValidation,
  validate,
  authController.updatePassword
);

// Logout user
router.get('/logout', authController.logout);

module.exports = router;
