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

    const [vendorRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'vendor' LIMIT 1;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [customerRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'customer' LIMIT 1;",
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

    // ========================================
    // ASSIGN PERMISSIONS TO VENDOR ROLE
    // ========================================
    if (vendorRole) {
      // Get all permissions to filter for vendor role
      const allPermissions = await queryInterface.sequelize.query(
        "SELECT id, name, resource, action FROM permissions;",
        { type: Sequelize.QueryTypes.SELECT }
      );

      // Vendor permissions: business operations, inventory, supply, orders, analytics
      const vendorPermissionNames = [
        // User management (vendor can manage their own profile)
        'users_read', 'users_update',
        // Address management
        'addresses_create', 'addresses_read', 'addresses_update', 'addresses_delete',
        // Cart management
        'cart_create', 'cart_read', 'cart_update', 'cart_delete',
        // Wishlist management
        'wishlist_create', 'wishlist_read', 'wishlist_update', 'wishlist_delete',
        // Product management (vendor can manage their own products)
        'products_create', 'products_read', 'products_update', 'products_delete', 'products_analytics',
        // Category management (vendor can view categories for products)
        'categories_read', 'categories_update',
        // Collection management (vendor can view collections for products)
        'collections_read', 'collections_update',
        // Inventory management
        'inventory_read', 'inventory_update', 'inventory_manage',
        // Supply management
        'supplies_create', 'supplies_read', 'supplies_update', 'supplies_delete',
        // Order management (vendor can view and update their orders)
        'orders_read', 'orders_update', 'orders_process',
        // Payment management (vendor can view their payment transactions)
        'payments_read', 'payments_process',
        // Payout management (vendor can view their payouts)
        'payouts_read', 'payouts_update',
        // Earnings/Analytics
        'earnings_read', 'earnings_export',
        'analytics_read', 'analytics_export', 'analytics_dashboard',
        // Reviews (vendor can read reviews for their products)
        'reviews_read',
        // Vendor management (vendor can manage their own profile)
        'vendors_read', 'vendors_update',
        // Support
        'support_read', 'support_create', 'support_update',
        // Journals
        'journals_read', 'journals_create', 'journals_update',
        // Notifications
        'notifications_read', 'notifications_update',
      ];

      const vendorPermissions = allPermissions.filter(p =>
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
      }
    }

    // ========================================
    // ASSIGN PERMISSIONS TO CUSTOMER ROLE
    // ========================================
    if (customerRole) {
      // Get all permissions to filter for customer role
      const allPermissions = await queryInterface.sequelize.query(
        "SELECT id, name, resource, action FROM permissions;",
        { type: Sequelize.QueryTypes.SELECT }
      );

      // Customer permissions: personal data, shopping, orders, reviews
      const customerPermissionNames = [
        // User management (customer can manage their own profile)
        'users_read', 'users_update',
        // Address management
        'addresses_create', 'addresses_read', 'addresses_update', 'addresses_delete',
        // Cart management
        'cart_create', 'cart_read', 'cart_update', 'cart_delete',
        // Wishlist management
        'wishlist_create', 'wishlist_read', 'wishlist_update', 'wishlist_delete',
        // Order management (customer can create, view, and cancel their orders)
        'orders_create', 'orders_read', 'orders_cancel',
        // Product management (customer can view products)
        'products_read',
        // Category management (customer can view categories)
        'categories_read',
        // Collection management (customer can view collections)
        'collections_read',
        // Inventory (customer can view availability)
        'inventory_read',
        // Payment management (customer can view their payment history)
        'payments_read',
        // Review management (customer can manage their own reviews)
        'reviews_create', 'reviews_read', 'reviews_update', 'reviews_delete',
        // Vendor following
        'vendors_read', 'vendors_follow',
        // Support
        'support_create', 'support_read', 'support_update',
        // Notifications
        'notifications_read', 'notifications_update',
      ];

      const customerPermissions = allPermissions.filter(p =>
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
