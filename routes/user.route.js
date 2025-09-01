const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middlewares/auth');
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
  .get(userController.getAllUsers)
  .post(createUserValidation, validate, userController.createUser);

router
  .route('/:id')
  .get(userController.getUser)
  .patch(updateUserValidation, validate, userController.updateUser)
  .delete(userController.deleteUser);

// Role management routes
router
  .route('/:id/roles')
  .post(assignRolesValidation, validate, userController.assignRoles)
  .delete(removeRolesValidation, validate, userController.removeRoles);

module.exports = router;
