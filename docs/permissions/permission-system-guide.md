# Permission System Guide

## Overview

The Laravel Spatie-like permission system implemented in Stylay API provides fine-grained access control using a resource-action based permission model. This guide explains the current implementation and how to extend it as your application grows.

## Current Implementation

### **Permission Structure**

The system uses a **resource-action** format for permissions:
- **Resource**: The entity being accessed (e.g., `products`, `orders`, `users`)
- **Action**: The action being performed (e.g., `create`, `read`, `update`, `delete`, `manage`)

**Permission naming format**: `{resource}_{action}` 
Examples:
- `products.create` - Create new products
- `products.read` - View products
- `products.update` - Update products
- `orders.manage` - Full order management
- `users.delete` - Delete users

### **Current Default Permissions**

The system includes 39 default permissions across multiple resources:

#### **User & Role Management**
```javascript
// User management
'manage_users', 'create_users', 'read_users', 'update_users', 'delete_users'

// Role management  
'manage_roles', 'create_roles', 'read_roles', 'update_roles', 'delete_roles'

// Permission management
'manage_permissions', 'create_permissions', 'read_permissions', 'update_permissions', 'delete_permissions'
```

#### **Business Operations**
```javascript
// Product management
'manage_products', 'create_products', 'read_products', 'update_products', 'delete_products'

// Order management
'manage_orders', 'create_orders', 'read_orders', 'update_orders', 'delete_orders'

// Vendor management
'manage_vendors', 'create_vendors', 'read_vendors', 'update_vendors', 'delete_vendors', 'approve_vendors', 'reject_vendors'

// Category management
'manage_categories', 'create_categories', 'read_categories', 'update_categories', 'delete_categories'

// Inventory management
'manage_inventory', 'create_inventory', 'read_inventory', 'update_inventory', 'delete_inventory'
```

#### **Customer & Reporting**
```javascript
// Dashboard and reports
'view_dashboard', 'view_reports', 'export_reports'

// Customer actions
'manage_cart', 'manage_wishlist'

// Reviews
'manage_reviews', 'create_reviews', 'read_reviews', 'update_reviews', 'delete_reviews'

// Addresses
'manage_addresses', 'create_addresses', 'read_addresses', 'update_addresses', 'delete_addresses'
```

## How Seeding Works

### **Seeding Process**

The permission seeding happens in two stages:

1. **Permission Creation** (`models/permission.model.js`):
   - Calls `Permission.seedDefaultPermissions()` method
   - Uses `findOrCreate()` to avoid duplicates
   - Auto-generates slug from permission name
   - Validates resource and action against allowed values

2. **Role Assignment** (`services/permission.service.js`):
   - Calls `PermissionService.assignDefaultPermissionsToRoles()`
   - Assigns permissions based on role type:
     - **Admin**: Gets all permissions
     - **Vendor**: Gets product, inventory, order, review, category permissions
     - **Customer**: Gets cart, wishlist, review, address, order permissions
     - **Others**: Get read permissions only

### **Running the Seeder**

```bash
# Run the permission seeder
npm run seed

# Or run specific seeder
npx sequelize-cli db:seed --seed seeders/20251101104400-seed-permissions.js
```

## Adding New Permissions

### **1. Adding New Resources**

When adding a new resource (e.g., `support_tickets`), update these locations:

**A. Update Permission Model** (`models/permission.model.js`):
```javascript
// In the resource validation array, add your new resource:
resource: {
  type: DataTypes.STRING(50),
  allowNull: false,
  validate: {
    notEmpty: {
      msg: 'Resource cannot be empty'
    },
    isIn: {
      args: [
        [
          'users', 'roles', 'permissions', 'products', 'categories', 'orders',
          'inventory', 'reviews', 'vendors', 'addresses', 'payments', 'carts',
          'collections', 'journals', 'variants', 'supply', 'notifications',
          'support', 'dashboard', 'reports', 'settings',
          'support_tickets',  // ← Add your new resource here
          'shipments',        // ← Another example
          'analytics'         // ← Another example
        ]
      ],
      msg: 'Resource must be a valid system resource'
    }
  }
}
```

**B. Update PermissionService** (`services/permission.service.js`):
```javascript
// In the createPermission method's validResources array:
const validResources = [
  'users', 'roles', 'permissions', 'products', 'categories', 'orders',
  'inventory', 'reviews', 'vendors', 'addresses', 'payments', 'carts',
  'collections', 'journals', 'variants', 'supply', 'notifications',
  'support', 'dashboard', 'reports', 'settings',
  'support_tickets',  // ← Add your new resource here
  'shipments',        // ← Another example
  'analytics'         // ← Another example
];
```

**C. Add Permission Definitions** (`models/permission.model.js`):
```javascript
// In the seedDefaultPermissions method, add your new permissions:
Permission.seedDefaultPermissions = async function() {
  const defaultPermissions = [
    // ... existing permissions ...
    
    // Support Tickets management
    { name: 'manage_support_tickets', resource: 'support_tickets', action: 'manage', description: 'Full support ticket management access' },
    { name: 'create_support_tickets', resource: 'support_tickets', action: 'create', description: 'Create new support tickets' },
    { name: 'read_support_tickets', resource: 'support_tickets', action: 'read', description: 'View support ticket information' },
    { name: 'update_support_tickets', resource: 'support_tickets', action: 'update', description: 'Update support ticket information' },
    { name: 'delete_support_tickets', resource: 'support_tickets', action: 'delete', description: 'Delete support tickets' },
    { name: 'resolve_support_tickets', resource: 'support_tickets', action: 'resolve', description: 'Resolve support tickets' },
    { name: 'close_support_tickets', resource: 'support_tickets', action: 'close', description: 'Close support tickets' },
    
    // Analytics management (if you add analytics)
    { name: 'view_analytics', resource: 'analytics', action: 'read', description: 'View analytics data' },
    { name: 'export_analytics', resource: 'analytics', action: 'export', description: 'Export analytics reports' }
  ];
  
  // ... rest of the method ...
};
```

**D. Update Role Assignment Logic** (`services/permission.service.js`):
```javascript
// In assignDefaultPermissionsToRoles method, add your resource to relevant roles:
switch (role.name) {
  case 'admin':
    // Admin gets all permissions (no changes needed)
    break;
    
  case 'vendor':
    // Existing vendor logic...
    
    // Add support ticket permissions for vendors if they handle tickets
    const supportTicketPermissions = permissions.filter(p => 
      ['support_tickets', 'shipments'].includes(p.resource)
);
    // ... assign logic
    break;
    
  case 'customer':
    // Existing customer logic...
    
    // Add customer-facing permissions
    const customerSupportPermissions = permissions.filter(p => 
      ['support_tickets'].includes(p.resource) && 
      ['create', 'read', 'update'].includes(p.action)
    );
    // ... assign logic
    break;
}
```

### **2. Adding New Actions**

Available actions: `create`, `read`, `update`, `delete`, `manage`, `view`, `list`, `export`, `import`, `approve`, `reject`, `activate`, `deactivate`, `archive`, `restore`

To add a new action (e.g., `resolve`, `close`):

**A. Update Permission Model** (`models/permission.model.js`):
```javascript
action: {
  type: DataTypes.STRING(50),
  allowNull: false,
  validate: {
    notEmpty: {
      msg: 'Action cannot be empty'
    },
    isIn: {
      args: [
        [
          'create', 'read', 'update', 'delete', 'manage', 'view', 'list',
          'export', 'import', 'approve', 'reject', 'activate', 'deactivate',
          'archive', 'restore',
          'resolve',    // ← Add your new action
          'close',      // ← Another example
          'escalate'    // ← Another example
        ]
      ],
      msg: 'Action must be a valid permission action'
    }
  }
}
```

**B. Update PermissionService** (`services/permission.service.js`):
```javascript
const validActions = [
  'create', 'read', 'update', 'delete', 'manage', 'view', 'list',
  'export', 'import', 'approve', 'reject', 'activate', 'deactivate',
  'archive', 'restore',
  'resolve',    // ← Add your new action
  'close',      // ← Another example
  'escalate'    // ← Another example
];
```

### **3. Creating New Permission Seeder (For Major Updates)**

For significant updates, create a new seeder file:

```bash
# Create new seeder
npx sequelize-cli seed:generate --name add-new-permissions
```

**Edit the new seeder file** (`seeders/[timestamp]-add-new-permissions.js`):
```javascript
'use strict';

const PermissionService = require('../services/permission.service');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('Adding new permissions...');
      
      // Add new permissions
      const newPermissions = [
        { name: 'manage_shipments', resource: 'shipments', action: 'manage', description: 'Full shipment management' },
        { name: 'track_shipments', resource: 'shipments', action: 'track', description: 'Track shipment status' },
        { name: 'export_analytics', resource: 'analytics', action: 'export', description: 'Export analytics data' }
      ];
      
      const created = [];
      for (const perm of newPermissions) {
        const [permission, wasCreated] = await PermissionService.createPermission(perm);
        if (wasCreated) {
          created.push(permission);
        }
      }
      
      // Assign to roles
      const roleResults = await PermissionService.assignDefaultPermissionsToRoles();
      
      console.log(`Created ${created.length} new permissions`);
      return { success: true, createdCount: created.length };
      
    } catch (error) {
      console.error('Error adding new permissions:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('Removing new permissions...');
      
      // Remove the new permissions
      const newPermissionNames = ['manage_shipments', 'track_shipments', 'export_analytics'];
      
      for (const name of newPermissionNames) {
        const permission = await queryInterface.sequelize.models.Permission.findOne({
          where: { name }
        });
        
        if (permission) {
          // Remove associations first
          await queryInterface.bulkDelete('permission_roles', { permission_id: permission.id });
          await queryInterface.bulkDelete('permission_users', { permission_id: permission.id });
          
          // Delete permission
          await permission.destroy();
        }
      }
      
      console.log('New permissions removed');
      return { success: true, message: 'New permissions removed' };
      
    } catch (error) {
      console.error('Error removing new permissions:', error);
      throw error;
    }
  }
};
```

**Run the new seeder**:
```bash
npx sequelize-cli db:seed --seed seeders/[timestamp]-add-new-permissions.js
```

## Using Permissions in Your Application

### **1. Route Protection**

```javascript
const { hasPermission, can } = require('../middlewares/permission');

// Protect routes with specific permissions
router.get('/admin/products', 
  hasPermission('read_products'), 
  productController.getAll
);

router.post('/products',
  can('products', 'create'),  // Resource-action checking
  productController.create
);

router.delete('/orders/:id',
  hasPermission('delete_orders'),
  orderController.delete
);
```

### **2. Programmatic Permission Checking**

```javascript
// In controllers or services
if (await req.user.hasPermission('manage_products')) {
  // User can manage products
}

if (await req.user.can('orders', 'update')) {
  // User can update orders
}

if (await req.user.hasAnyPermission(['view_reports', 'export_reports'])) {
  // User has at least one of these permissions
}

if (await req.user.hasAllPermissions(['read_products', 'read_orders'])) {
  // User has all these permissions
}
```

### **3. Dynamic Permission Assignment**

```javascript
// Add permission to role
await PermissionService.assignPermissionToRole(permissionId, roleId);

// Add direct permission to user
await PermissionService.assignPermissionToUser(permissionId, userId);

// Check permissions programmatically
const hasAccess = await PermissionService.hasPermission(userId, 'manage_products');
```

## Best Practices

### **1. Permission Naming Conventions**

- Use lowercase with underscores
- Follow `{resource}_{action}` format
- Be descriptive but concise
- Use standard actions: `create`, `read`, `update`, `delete`, `manage`

### **2. Resource Organization**

Group related permissions under the same resource:
```javascript
// Good: Related permissions
'products.create', 'products.read', 'products.update', 'products.delete'

// Avoid: Unrelated actions
'products.create', 'products.delete', 'users.create', 'orders.read'
```

### **3. Role-Based Assignment**

Assign permissions logically based on role responsibilities:

```javascript
// Admin: All permissions
case 'admin':
  // Assign everything
  break;

// Vendor: Business operations
case 'vendor':
  // Products, orders, inventory, reviews
  break;

// Customer: Personal and purchase-related
case 'customer':
  // Cart, wishlist, orders, addresses, reviews
  break;
```

### **4. Granular vs. Broad Permissions**

Choose appropriate granularity:
```javascript
// Granular: More control
'products.create', 'products.publish', 'products.archive'

// Broad: Simpler management
'products.manage'

// Use broad permissions for common operations
// Use granular permissions for sensitive operations
```

### **5. Testing Permissions**

```javascript
// Test in development
console.log('User permissions:', await req.user.getAllPermissions());
console.log('Has manage_products:', await req.user.hasPermission('manage_products'));

// API testing
GET /api/v1/users/1/permissions    // Get user permissions
POST /api/v1/permissions           // Create new permission
POST /api/v1/permissions/1/roles   // Assign to role
```

## Common Scenarios

### **Adding E-commerce Features**

```javascript
// For a new "discounts" feature
const discountPermissions = [
  'manage_discounts', 'create_discounts', 'read_discounts', 
  'update_discounts', 'delete_discounts', 'apply_discounts',
  'bulk_discounts', 'schedule_discounts'
];

// For shipping features
const shippingPermissions = [
  'manage_shipping', 'create_shipping', 'read_shipping',
  'update_shipping', 'delete_shipping', 'track_shipping',
  'calculate_shipping', 'manage_carriers'
];
```

### **Adding Admin Features**

```javascript
// System administration
const systemPermissions = [
  'manage_system', 'view_logs', 'clear_cache',
  'backup_database', 'restore_database', 'system_settings'
];

// User management
const userAdminPermissions = [
  'suspend_users', 'activate_users', 'bulk_user_actions',
  'view_user_activity', 'impersonate_users'
];
```

### **Adding API Permissions**

```javascript
// For third-party API access
const apiPermissions = [
  'api_access', 'api_read', 'api_write', 'api_admin',
  'webhook_manage', 'integration_manage'
];
```

## Troubleshooting

### **Permission Not Working**

1. **Check seeder ran successfully**:
   ```bash
   npm run seed
   ```

2. **Verify permission exists**:
   ```bash
   GET /api/v1/permissions
   ```

3. **Check user has permission**:
   ```bash
   GET /api/v1/users/1/permissions
   ```

4. **Clear permission cache** if implemented

### **Validation Errors**

1. **Resource not in allowed list**: Update model validation arrays
2. **Action not supported**: Add to action validation
3. **Permission name conflicts**: Use unique naming

### **Role Assignment Issues**

1. **Check role exists**: Verify in database
2. **Permission already assigned**: System handles duplicates gracefully
3. **New role not getting permissions**: Update assignment logic

## Summary

The permission system is designed to be:
- **Extensible**: Easy to add new resources and actions
- **Maintainable**: Clear structure and naming conventions
- **Scalable**: Supports complex permission hierarchies
- **Flexible**: Multiple assignment strategies (role-based + direct)

Remember to update both the model validation arrays and the seeding logic when adding new permissions, and test thoroughly with different user roles.
