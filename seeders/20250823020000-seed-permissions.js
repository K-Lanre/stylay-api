'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get permission templates from PermissionService
    const PermissionService = require('../services/permission.service');
    const permissionTemplates = PermissionService.getPermissionTemplates();

    // Transform templates into database records
    const permissions = permissionTemplates.map(template => ({
      name: `${template.resource}_${template.action}`,
      resource: template.resource,
      action: template.action,
      description: template.description,
      created_at: new Date(),
      updated_at: new Date()
    }));

    // Insert permissions
    await queryInterface.bulkInsert('permissions', permissions, {});

    // Get role IDs
    const [adminRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'admin' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [subAdminRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'sub-admin' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Assign all permissions to admin role
    if (adminRole) {
      const insertedPermissions = await queryInterface.sequelize.query(
        "SELECT id FROM permissions;",
        { type: Sequelize.QueryTypes.SELECT }
      );

      const adminRolePermissions = insertedPermissions.map(permission => ({
        role_id: adminRole.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await queryInterface.bulkInsert('role_permissions', adminRolePermissions, {});
    }

    // Assign limited permissions to sub-admin role (exclude system admin permissions)
    if (subAdminRole) {
      // Get permissions excluding system admin group
      const subAdminPermissions = await queryInterface.sequelize.query(
        "SELECT id FROM permissions WHERE resource != 'system';",
        { type: Sequelize.QueryTypes.SELECT }
      );

      // Exclude user management create/delete/manage and analytics dashboard permissions
      const filteredPermissions = subAdminPermissions.filter(permission => {
        // Allow all vendor, product, earnings, feedback, notification permissions
        if (['vendors', 'products', 'categories', 'collections', 'inventory', 'supply',
             'orders', 'payments', 'payouts', 'earnings', 'journals',
             'reviews', 'support', 'notifications'].includes(permission.resource)) {
          return true;
        }

        // For user management, only allow read and update
        if (permission.resource === 'users') {
          return permission.action === 'read' || permission.action === 'update';
        }

        // For analytics, only allow read and export
        if (permission.resource === 'analytics') {
          return permission.action === 'read' || permission.action === 'export';
        }

        return false;
      });

      const subAdminRolePermissions = filteredPermissions.map(permission => ({
        role_id: subAdminRole.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date()
      }));

      if (subAdminRolePermissions.length > 0) {
        await queryInterface.bulkInsert('role_permissions', subAdminRolePermissions, {});
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove all role permissions
    await queryInterface.bulkDelete('role_permissions', null, {});

    // Remove all permissions
    await queryInterface.bulkDelete('permissions', null, {});
  }
};
