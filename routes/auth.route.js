const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { validate } = require("../validators/auth.validator");
const { protect, localAuth, restrictTo } = require("../middlewares/auth");
const { hasPermission, isAdminOrHasPermission } = require("../middlewares/permission");
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

// Public routes with permission checks
router.post("/register", registerValidation, validate, hasPermission('register_user'), authController.register);
router.post("/register-admin", registerValidation, validate, hasPermission('register_admin'), authController.registerAdmin);

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
  hasPermission('verify_email'),
  authController.verifyEmail
);
router.post(
  "/resend-verification",
  resendVerificationValidation,
  validate,
  hasPermission('resend_verification'),
  authController.resendVerificationCode
);
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  validate,
  hasPermission('request_password_reset'),
  authController.forgotPassword
);
router.post(
  "/reset-password",
  resetPasswordValidation,
  validate,
  hasPermission('reset_password'),
  authController.resetPassword
);

// Phone change verification (public route)
router.get("/verify-phone-change/:token", hasPermission('verify_phone_change'), authController.verifyPhoneChange);

// Protected routes (require authentication)
router.use(protect);

// User routes with permission checks
router.get("/me", protect, hasPermission('view_own_profile'), authController.getMe);
router.put(
  "/me",
  protect,
  updateProfileValidation,
  validate,
  hasPermission('update_own_profile'),
  authController.updateProfile
);
router.patch(
  "/update-password",
  protect,
  updatePasswordValidation,
  validate,
  hasPermission('change_own_password'),
  authController.updatePassword
);

// Phone change routes with permission checks
router.post(
  "/request-phone-change",
  protect,
  requestPhoneChangeValidation,
  validate,
  hasPermission('request_phone_change'),
  authController.requestPhoneChange
);
router.post(
  "/cancel-phone-change",
  protect,
  cancelPhoneChangeValidation,
  validate,
  hasPermission('cancel_phone_change'),
  authController.cancelPhoneChange
);

// Logout with permission check
router.get("/logout", protect, hasPermission('logout_user'), authController.logout);

// Admin routes (require admin role + additional permissions)
router.use(restrictTo("admin"));

// Phone change admin routes with permission checks
router.get("/pending-phone-changes", hasPermission('view_pending_phone_changes'), authController.getPendingPhoneChanges);
router.patch(
  "/approve-phone-change/:userId",
  hasPermission('approve_phone_change'),
  authController.approvePhoneChange
);
router.patch("/reject-phone-change/:userId", hasPermission('reject_phone_change'), authController.rejectPhoneChange);

module.exports = router;
