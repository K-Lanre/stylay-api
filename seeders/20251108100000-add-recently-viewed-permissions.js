'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Define recently viewed permissions
    const newPermissions = [
      // ========================================
      // RECENTLY VIEWED PRODUCTS (NEW)
      // ========================================
      { resource: 'recently_viewed', action: 'read', description: 'View recently viewed products', group: 'user_experience' },
      { resource: 'recently_viewed', action: 'update', description: 'Anonymize recently viewed data', group: 'user_experience' },
      { resource: 'recently_viewed', action: 'delete', description: 'Clear recently viewed history', group: 'user_experience' },
    ];

    // Transform templates into database records
    const permissions = newPermissions.map(template => ({
      name: `${template.resource}_${template.action}`,
      resource: template.resource,
      action: template.action,
      description: template.description,
      created_at: new Date(),
      updated_at: new Date()
    }));

    // Check which permissions already exist
    const existingPermissions = await queryInterface.sequelize.query(
      `SELECT name FROM permissions WHERE name IN (${permissions.map(p => `'${p.name}'`).join(',')});`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const existingPermissionNames = existingPermissions.map(p => p.name);
    
    // Filter out existing permissions
    const permissionsToInsert = permissions.filter(p => !existingPermissionNames.includes(p.name));

    if (permissionsToInsert.length > 0) {
      // Insert new permissions
      await queryInterface.bulkInsert('permissions', permissionsToInsert, {});
      console.log(`Inserted ${permissionsToInsert.length} new recently viewed permissions`);
    } else {
      console.log('No new recently viewed permissions to insert');
      return;
    }

    // Get role IDs
    const [adminRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'admin' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [vendorRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'vendor' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [customerRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'customer' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Get IDs of newly inserted permissions
    const insertedPermissions = await queryInterface.sequelize.query(
      `SELECT id, name, resource, action FROM permissions WHERE name IN (${permissionsToInsert.map(p => `'${p.name}'`).join(',')});`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // ========================================
    // ASSIGN PERMISSIONS TO ADMIN ROLE
    // ========================================
    // Admin gets ALL permissions
    if (adminRole && insertedPermissions.length > 0) {
      const adminRolePermissions = insertedPermissions.map(permission => ({
        role_id: adminRole.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await queryInterface.bulkInsert('role_permissions', adminRolePermissions, {});
      console.log(`Assigned ${adminRolePermissions.length} recently viewed permissions to admin role`);
    }

    // ========================================
    // ASSIGN PERMISSIONS TO VENDOR ROLE
    // ========================================
    if (vendorRole && insertedPermissions.length > 0) {
      // Vendors can view, update, and delete their recently viewed products
      const vendorPermissionNames = [
        'recently_viewed_read',
        'recently_viewed_update',
        'recently_viewed_delete',
      ];

      const vendorPermissions = insertedPermissions.filter(p => 
        vendorPermissionNames.includes(p.name)
      );

      if (vendorPermissions.length > 0) {
        const vendorRolePermissions = vendorPermissions.map(permission => ({
          role_id: vendorRole.id,
          permission_id: permission.id,
          created_at: new Date(),
          updated_at: new Date()
        }));

        await queryInterface.bulkInsert('role_permissions', vendorRolePermissions, {});
        console.log(`Assigned ${vendorRolePermissions.length} recently viewed permissions to vendor role`);
      }
    }

    // ========================================
    // ASSIGN PERMISSIONS TO CUSTOMER ROLE
    // ========================================
    if (customerRole && insertedPermissions.length > 0) {
      // Customers can view, update, and delete their recently viewed products
      const customerPermissionNames = [
        'recently_viewed_read',
        'recently_viewed_update',
        'recently_viewed_delete',
      ];

      const customerPermissions = insertedPermissions.filter(p => 
        customerPermissionNames.includes(p.name)
      );

      if (customerPermissions.length > 0) {
        const customerRolePermissions = customerPermissions.map(permission => ({
          role_id: customerRole.id,
          permission_id: permission.id,
          created_at: new Date(),
          updated_at: new Date()
        }));

        await queryInterface.bulkInsert('role_permissions', customerRolePermissions, {});
        console.log(`Assigned ${customerPermissions.length} recently viewed permissions to customer role`);
      }
    }

    console.log('Recently viewed permissions migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    // Get the permission names that were added
    const permissionNames = [
      'recently_viewed_read',
      'recently_viewed_update',
      'recently_viewed_delete',
    ];

    // Get permission IDs
    const permissions = await queryInterface.sequelize.query(
      `SELECT id FROM permissions WHERE name IN (${permissionNames.map(name => `'${name}'`).join(',')});`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (permissions.length > 0) {
      const permissionIds = permissions.map(p => p.id);

      // Remove role permissions
      await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE permission_id IN (${permissionIds.join(',')});`
      );

      // Remove permissions
      await queryInterface.sequelize.query(
        `DELETE FROM permissions WHERE id IN (${permissionIds.join(',')});`
      );

      console.log(`Removed ${permissions.length} recently viewed permissions and their role assignments`);
    }
  }
};