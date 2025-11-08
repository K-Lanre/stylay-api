'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Define all missing permissions based on route analysis
    const newPermissions = [
      // ========================================
      // ADDRESS MANAGEMENT (NEW)
      // ========================================
      { resource: 'addresses', action: 'create', description: 'Create new addresses', group: 'address_management' },
      { resource: 'addresses', action: 'read', description: 'View address information', group: 'address_management' },
      { resource: 'addresses', action: 'update', description: 'Update address information', group: 'address_management' },
      { resource: 'addresses', action: 'delete', description: 'Delete addresses', group: 'address_management' },

      // ========================================
      // CART MANAGEMENT (ADDITIONAL)
      // ========================================
      { resource: 'cart', action: 'create', description: 'Add items to cart', group: 'cart_management' },
      { resource: 'cart', action: 'read', description: 'View cart contents', group: 'cart_management' },
      { resource: 'cart', action: 'update', description: 'Update cart items', group: 'cart_management' },
      { resource: 'cart', action: 'delete', description: 'Remove items from cart', group: 'cart_management' },

      // ========================================
      // WISHLIST MANAGEMENT (NEW)
      // ========================================
      { resource: 'wishlist', action: 'create', description: 'Create and add to wishlists', group: 'wishlist_management' },
      { resource: 'wishlist', action: 'read', description: 'View wishlist contents', group: 'wishlist_management' },
      { resource: 'wishlist', action: 'update', description: 'Update wishlist items', group: 'wishlist_management' },
      { resource: 'wishlist', action: 'delete', description: 'Delete wishlists and items', group: 'wishlist_management' },

      // ========================================
      // VARIANT MANAGEMENT (NEW)
      // ========================================
      { resource: 'variants', action: 'create', description: 'Create product variants', group: 'products_management' },
      { resource: 'variants', action: 'read', description: 'View product variants', group: 'products_management' },
      { resource: 'variants', action: 'update', description: 'Update product variants', group: 'products_management' },
      { resource: 'variants', action: 'delete', description: 'Delete product variants', group: 'products_management' },

      // ========================================
      // SUPPLY MANAGEMENT (ADDITIONAL - Fix namespace)
      // ========================================
      { resource: 'supplies', action: 'create', description: 'Create supply records', group: 'products_management' },
      { resource: 'supplies', action: 'read', description: 'View supply information', group: 'products_management' },
      { resource: 'supplies', action: 'update', description: 'Update supply information', group: 'products_management' },
      { resource: 'supplies', action: 'delete', description: 'Delete supply records', group: 'products_management' },

      // ========================================
      // REVIEW MANAGEMENT (ADDITIONAL)
      // ========================================
      { resource: 'reviews', action: 'create', description: 'Create product reviews', group: 'feedbacks_support' },

      // ========================================
      // ORDER MANAGEMENT (ADDITIONAL)
      // ========================================
      { resource: 'orders', action: 'create', description: 'Create new orders', group: 'earnings_payment' },
      { resource: 'orders', action: 'delete', description: 'Delete orders', group: 'earnings_payment' },

      // ========================================
      // JOURNAL MANAGEMENT (ADDITIONAL)
      // ========================================
      { resource: 'journals', action: 'create', description: 'Create journal entries', group: 'content_management' },
      { resource: 'journals', action: 'update', description: 'Update journal entries', group: 'content_management' },
      { resource: 'journals', action: 'delete', description: 'Delete journal entries', group: 'content_management' },

      // ========================================
      // WEBHOOK MANAGEMENT (NEW)
      // ========================================
      { resource: 'webhooks', action: 'create', description: 'Create webhook configurations', group: 'system_admin' },
      { resource: 'webhooks', action: 'read', description: 'View webhook logs and configurations', group: 'system_admin' },
      { resource: 'webhooks', action: 'update', description: 'Update webhook configurations', group: 'system_admin' },
      { resource: 'webhooks', action: 'delete', description: 'Delete webhook configurations', group: 'system_admin' },

      // ========================================
      // ROLE MANAGEMENT (ADDITIONAL)
      // ========================================
      { resource: 'roles', action: 'create', description: 'Create new roles', group: 'user_management' },
      { resource: 'roles', action: 'read', description: 'View role information', group: 'user_management' },
      { resource: 'roles', action: 'update', description: 'Update role information', group: 'user_management' },
      { resource: 'roles', action: 'delete', description: 'Delete roles', group: 'user_management' },
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
      console.log(`Inserted ${permissionsToInsert.length} new permissions`);
    } else {
      console.log('No new permissions to insert');
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
      console.log(`Assigned ${adminRolePermissions.length} permissions to admin role`);
    }

    // ========================================
    // ASSIGN PERMISSIONS TO VENDOR ROLE
    // ========================================
    if (vendorRole && insertedPermissions.length > 0) {
      // Vendor permissions: products, inventory, supply, orders (read/update), reviews (read), analytics, variants, cart
      const vendorPermissionNames = [
        // User management
        'users_read',
        'users_update',

        // Product management (vendor can manage their own products)
        'products_create',
        'products_read',
        'products_update',
        'products_delete',
        'products_analytics',
        
        // Variant management
        'variants_create',
        'variants_read',
        'variants_update',
        'variants_delete',

        // Cart management
        'cart_read',
        'cart_create',
        'cart_update',
        'cart_delete',
        
        // Inventory management
        'inventory_read',
        'inventory_update',
        
        // Supply management
        'supplies_create',
        'supplies_read',
        'supplies_update',
        
        // Order management (vendor can view and update their orders)
        'orders_read',
        'orders_update',
        
        // Reviews (vendor can read reviews)
        'reviews_read',
        
        // Analytics
        'analytics_read',
        'analytics_dashboard',
        
        // Earnings
        'earnings_read',
        'earnings_export',
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
        console.log(`Assigned ${vendorRolePermissions.length} permissions to vendor role`);
      }
    }

    // ========================================
    // ASSIGN PERMISSIONS TO CUSTOMER ROLE
    // ========================================
    if (customerRole && insertedPermissions.length > 0) {
      // Customer permissions: addresses, cart, wishlist, orders (create/read/cancel), reviews (create/read/update/delete own)
      const customerPermissionNames = [
        // User management
        'users_read',
        'users_update',
        // Address management
        'addresses_create',
        'addresses_read',
        'addresses_update',
        'addresses_delete',
        
        // Cart management
        'cart_create',
        'cart_read',
        'cart_update',
        'cart_delete',
        
        // Wishlist management
        'wishlist_create',
        'wishlist_read',
        'wishlist_update',
        'wishlist_delete',
        
        // Order management (customer can create, view, and cancel their orders)
        'orders_create',
        'orders_read',
        'orders_cancel',
        
        // Review management (customer can manage their own reviews)
        'reviews_create',
        'reviews_read',
        'reviews_update',
        'reviews_delete',
        
        // Vendor following
        'vendors_follow',
        'vendors_read',
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
        console.log(`Assigned ${customerPermissions.length} permissions to customer role`);
      }
    }

    console.log('Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    // Get the permission names that were added
    const permissionNames = [
      // Addresses
      'addresses_create', 'addresses_read', 'addresses_update', 'addresses_delete',
      
      // Cart
      'cart_create', 'cart_read', 'cart_update', 'cart_delete',
      
      // Wishlist
      'wishlist_create', 'wishlist_read', 'wishlist_update', 'wishlist_delete',
      
      // Variants
      'variants_create', 'variants_read', 'variants_update', 'variants_delete',
      
      // Supplies (fixed namespace)
      'supplies_create', 'supplies_read', 'supplies_update', 'supplies_delete',
      
      // Reviews
      'reviews_create',
      
      // Orders
      'orders_create', 'orders_delete',
      
      // Journals
      'journals_create', 'journals_update', 'journals_delete',
      
      // Webhooks
      'webhooks_create', 'webhooks_read', 'webhooks_update', 'webhooks_delete',
      
      // Roles
      'roles_create', 'roles_read', 'roles_update', 'roles_delete',
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

      console.log(`Removed ${permissions.length} permissions and their role assignments`);
    }
  }
};
