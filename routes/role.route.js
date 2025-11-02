const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { protect, restrictTo } = require('../middlewares/auth');
const { hasPermission } = require('../middlewares/permission');
const {
  createRoleValidation,
  updateRoleValidation,
  deleteRoleValidation,
  validate
} = require('../validators/role.validator');

// Protect all routes after this middleware
router.use(protect);

// Restrict all routes to admin only
router.use(restrictTo('admin'));

// Routes with validation middleware
router
  .route('/')
  .get(hasPermission('read_roles'), roleController.getAllRoles)
  .post(createRoleValidation, validate, hasPermission('create_roles'), roleController.createRole);

router
  .route('/:id')
  .get(hasPermission('read_roles'), roleController.getRole)
  .patch(updateRoleValidation, validate, hasPermission('update_roles'), roleController.updateRole)
  .delete(deleteRoleValidation, validate, hasPermission('delete_roles'), roleController.deleteRole);

module.exports = router;
