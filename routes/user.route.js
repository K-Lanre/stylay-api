const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middlewares/auth');
const { hasPermission } = require('../middlewares/permission');
const {
  createUserValidation,
  updateUserValidation,
  assignRolesValidation,
  removeRolesValidation,
  validate
} = require('../validators/user.validator');

// Protect all routes with authentication
router.use(protect);

// Restrict all user management routes to admin only
router.use(restrictTo('admin'));

// User management routes
router
  .route('/')
  .get(hasPermission('view_users_admin'), userController.getAllUsers)
  .post(createUserValidation, validate, hasPermission('create_users'), userController.createUser);

router
  .route('/:id')
  .get(hasPermission('view_single_user_admin'), userController.getUser)
  .patch(updateUserValidation, validate, hasPermission('update_users'), userController.updateUser)
  .delete(hasPermission('delete_users'), userController.deleteUser);

// Role management routes
router
  .route('/:id/roles')
  .post(assignRolesValidation, validate, hasPermission('assign_user_roles_admin'), userController.assignRoles)
  .delete(removeRolesValidation, validate, hasPermission('remove_user_roles_admin'), userController.removeRoles);

module.exports = router;
