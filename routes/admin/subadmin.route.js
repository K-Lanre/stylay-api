const express = require('express');
const subAdminController = require('../../controllers/subadmin.controller');
const {
  createSubAdminValidation,
  updateSubAdminPermissionsValidation,
  updateSubAdminValidation,
  getSubAdminsValidation,
  getSubAdminValidation,
  deleteSubAdminValidation,
  getPermissionGroupsValidation
} = require('../../validators/subadmin.validator');
const { requirePermission, loadUserPermissions } = require('../../middlewares/permissions');
const auth = require('../../middlewares/auth');

const router = express.Router();

// Apply authentication and permission loading to all routes
router.use(auth.protect);
router.use(loadUserPermissions);

// Sub-admin management routes
router
  .route('/')
  .get(getSubAdminsValidation, requirePermission('users_read'), subAdminController.getSubAdmins)
  .post(createSubAdminValidation, requirePermission('users_create'), subAdminController.createSubAdmin);

router
  .route('/:id')
  .get(getSubAdminValidation, requirePermission('users_read'), subAdminController.getSubAdmin)
  .patch(updateSubAdminValidation, requirePermission('users_update'), subAdminController.updateSubAdmin)
  .delete(deleteSubAdminValidation, requirePermission('users_delete'), subAdminController.deleteSubAdmin);

// Permission management routes
router
  .route('/:id/permissions')
  .patch(updateSubAdminPermissionsValidation, requirePermission('users_update'), subAdminController.updateSubAdminPermissions);

// Utility routes for getting available permissions and roles
router.get('/permissions/all', requirePermission('users_read'), subAdminController.getPermissions);
router.get('/roles/all', requirePermission('users_read'), subAdminController.getRoles);
router.get('/permission-groups/all', getPermissionGroupsValidation, subAdminController.getPermissionGroups);

module.exports = router;
