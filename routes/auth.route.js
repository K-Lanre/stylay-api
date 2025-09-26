const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { validate } = require("../validators/auth.validator");
const { protect, localAuth, restrictTo } = require("../middlewares/auth");
const {
  registerValidation,
  loginValidation,
  updatePasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  requestPhoneChangeValidation,
  cancelPhoneChangeValidation,
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

// Phone change verification (public route)
router.get("/verify-phone-change/:token", authController.verifyPhoneChange);

// Protected routes (require authentication)
router.use(protect);

// User routes
router.get("/me", authController.getMe);
router.put(
  "/me",
  updateProfileValidation,
  validate,
  authController.updateProfile
);
router.patch(
  "/update-password",
  updatePasswordValidation,
  validate,
  authController.updatePassword
);

// Phone change routes
router.post(
  "/request-phone-change",
  requestPhoneChangeValidation,
  validate,
  authController.requestPhoneChange
);
router.post(
  "/cancel-phone-change",
  cancelPhoneChangeValidation,
  validate,
  authController.cancelPhoneChange
);

// Logout (public but typically called by authenticated users)
router.get("/logout", authController.logout);

// Admin routes (require admin role)
router.use(restrictTo("admin"));

// Phone change admin routes
router.get("/pending-phone-changes", authController.getPendingPhoneChanges);
router.patch(
  "/approve-phone-change/:userId",
  authController.approvePhoneChange
);
router.patch("/reject-phone-change/:userId", authController.rejectPhoneChange);

module.exports = router;
