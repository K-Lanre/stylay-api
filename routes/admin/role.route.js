const express = require('express');
const router = express.Router();
const roleController = require('../../controllers/role.controller');
const { protect, restrictTo } = require('../../middlewares/auth');
const { 
  createRoleValidation, 
  updateRoleValidation, 
  deleteRoleValidation, 
  validate 
} = require('../../validators/role.validator');

// Protect all routes after this middleware
router.use(protect);

// Restrict all routes to admin only
router.use(restrictTo('admin'));

// Routes with validation middleware
router
  .route('/')
  .get(roleController.getAllRoles)
  .post(createRoleValidation, validate, roleController.createRole);

router
  .route('/:id')
  .get(roleController.getRole)
  .patch(updateRoleValidation, validate, roleController.updateRole)
  .delete(deleteRoleValidation, validate, roleController.deleteRole);

module.exports = router;
