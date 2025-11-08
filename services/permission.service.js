const { Permission, Role, RolePermission, User, UserRole } = require('../models');
const AppError = require('../utils/appError');

class PermissionService {
  /**
   * Check if a user has a specific permission
   * @param {Object} user - User instance with roles and permissions loaded
   * @param {string} permissionName - Name of the permission to check
   * @returns {boolean} True if user has the permission
   */
  static async checkPermission(user, permissionName) {
    if (!user || !user.roles) {
      return false;
    }

    // Check if user has admin role (backward compatibility)
    const hasAdminRole = user.roles.some(role => role.name === 'admin');
    if (hasAdminRole) {
      return true; // Admins have all permissions
    }

    // Check specific permissions
    for (const role of user.roles) {
      if (role.permissions && role.permissions.some(perm => perm.name === permissionName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all permissions for a user
   * @param {number} userId - User ID
   * @returns {Array} Array of permission objects
   */
  static async getUserPermissions(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Role,
            as: 'roles',
            include: [
              {
                model: Permission,
                as: 'permissions',
                through: { attributes: [] } // Exclude junction table attributes
              }
            ],
            through: { attributes: [] } // Exclude junction table attributes
          }
        ]
      });

      if (!user || !user.roles) {
        return [];
      }

      const permissions = [];
      for (const role of user.roles) {
        if (role.permissions) {
          permissions.push(...role.permissions);
        }
      }

      // Remove duplicates based on permission id
      const uniquePermissions = permissions.filter((permission, index, self) =>
        index === self.findIndex(p => p.id === permission.id)
      );

      return uniquePermissions;
    } catch (error) {
      throw new AppError('Failed to get user permissions', 500);
    }
  }

  /**
   * Assign permissions to a role
   * @param {number} roleId - Role ID
   * @param {Array<number>} permissionIds - Array of permission IDs
   * @param {Object} transaction - Database transaction (optional)
   * @returns {Object} Result object with success status
   */
  static async assignPermissionsToRole(roleId, permissionIds, transaction = null) {
    try {
      // Verify role exists
      const role = await Role.findByPk(roleId, transaction ? { transaction } : {});
      if (!role) {
        throw new AppError('Role not found', 404);
      }

      // Verify all permissions exist
      const permissions = await Permission.findAll({
        where: { id: permissionIds },
        ...(transaction && { transaction })
      });

      if (permissions.length !== permissionIds.length) {
        throw new AppError('One or more permissions not found', 404);
      }

      // Remove existing permissions for this role
      await RolePermission.destroy({
        where: { role_id: roleId },
        ...(transaction && { transaction })
      });

      // Assign new permissions
      const rolePermissions = permissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId
      }));

      await RolePermission.bulkCreate(rolePermissions, {
        ...(transaction && { transaction })
      });

      return {
        success: true,
        message: `Assigned ${permissionIds.length} permissions to role ${role.name}`,
        assignedPermissions: permissions.length
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to assign permissions to role', 500);
    }
  }

  /**
   * Remove permissions from a role
   * @param {number} roleId - Role ID
   * @param {Array<number>} permissionIds - Array of permission IDs to remove
   * @returns {Object} Result object with success status
   */
  static async removePermissionsFromRole(roleId, permissionIds) {
    try {
      const deletedCount = await RolePermission.destroy({
        where: {
          role_id: roleId,
          permission_id: permissionIds
        }
      });

      return {
        success: true,
        message: `Removed ${deletedCount} permissions from role`,
        removedPermissions: deletedCount
      };
    } catch (error) {
      throw new AppError('Failed to remove permissions from role', 500);
    }
  }

  /**
   * Get all permissions
   * @param {Object} options - Query options
   * @param {string} options.resource - Filter by resource
   * @param {string} options.action - Filter by action
   * @returns {Array} Array of permission objects
   */
  static async getAllPermissions(options = {}) {
    try {
      const whereClause = {};
      if (options.resource) {
        whereClause.resource = options.resource;
      }
      if (options.action) {
        whereClause.action = options.action;
      }

      const permissions = await Permission.findAll({
        where: whereClause,
        order: [['resource', 'ASC'], ['action', 'ASC']]
      });

      return permissions;
    } catch (error) {
      throw new AppError('Failed to get permissions', 500);
    }
  }

  /**
   * Get permissions for a specific role
   * @param {number} roleId - Role ID
   * @returns {Array} Array of permission objects
   */
  static async getRolePermissions(roleId) {
    try {
      const role = await Role.findByPk(roleId, {
        include: [
          {
            model: Permission,
            as: 'permissions',
            through: { attributes: [] }
          }
        ]
      });

      if (!role) {
        throw new AppError('Role not found', 404);
      }

      return role.permissions || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get role permissions', 500);
    }
  }

  /**
   * Create a new permission
   * @param {Object} permissionData - Permission data
   * @param {string} permissionData.name - Permission name
   * @param {string} permissionData.resource - Resource name
   * @param {string} permissionData.action - Action name
   * @param {string} permissionData.description - Permission description
   * @returns {Object} Created permission object
   */
  static async createPermission(permissionData) {
    try {
      const { name, resource, action, description } = permissionData;

      // Check if permission already exists
      const existingPermission = await Permission.findOne({
        where: { name }
      });

      if (existingPermission) {
        throw new AppError('Permission with this name already exists', 409);
      }

      const permission = await Permission.create({
        name,
        resource,
        action,
        description
      });

      return permission;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create permission', 500);
    }
  }

  /**
   * Delete a permission
   * @param {number} permissionId - Permission ID
   * @returns {Object} Result object with success status
   */
  static async deletePermission(permissionId) {
    try {
      const permission = await Permission.findByPk(permissionId);
      if (!permission) {
        throw new AppError('Permission not found', 404);
      }

      // Check if permission is assigned to any roles
      const rolePermissions = await RolePermission.findAll({
        where: { permission_id: permissionId }
      });

      if (rolePermissions.length > 0) {
        throw new AppError('Cannot delete permission that is assigned to roles', 409);
      }

      await permission.destroy();

      return {
        success: true,
        message: 'Permission deleted successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete permission', 500);
    }
  }

  /**
   * Check if user has admin role (backward compatibility)
   * @param {Object} user - User instance
   * @returns {boolean} True if user has admin role
   */
  static hasAdminRole(user) {
    if (!user || !user.roles) {
      return false;
    }
    return user.roles.some(role => role.name === 'admin');
  }

  /**
   * Get permission groups and their permissions
   * @param {Object} options - Query options
   * @param {boolean} options.includeIds - Include actual permission IDs from database
   * @returns {Object} Object with groups as keys and permission arrays as values
   */
  static async getPermissionGroups(options = {}) {
    const templates = this.getPermissionTemplates();
    const groups = {};

    templates.forEach(template => {
      const group = template.group;
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push({
        name: `${template.resource}_${template.action}`,
        resource: template.resource,
        action: template.action,
        description: template.description
      });
    });

    // If includeIds is true, fetch actual permission IDs from database
    if (options.includeIds) {
      try {
        for (const groupName in groups) {
          const groupPermissions = groups[groupName];

          for (const permission of groupPermissions) {
            const dbPermission = await Permission.findOne({
              where: { name: permission.name }
            });

            if (dbPermission) {
              permission.id = dbPermission.id;
            }
          }
        }
      } catch (error) {
        // If database query fails, continue without IDs
        console.warn('Failed to fetch permission IDs:', error.message);
      }
    }

    return groups;
  }

  /**
   * Get permissions for specific groups
   * @param {string[]} groupNames - Array of group names
   * @returns {Array} Array of permission objects for the specified groups
   */
  static getPermissionsByGroups(groupNames) {
    const templates = this.getPermissionTemplates();
    return templates
      .filter(template => groupNames.includes(template.group))
      .map(template => ({
        name: `${template.resource}_${template.action}`,
        resource: template.resource,
        action: template.action,
        description: template.description,
        group: template.group
      }));
  }

  /**
   * Assign permissions to a role by groups
   * @param {number} roleId - Role ID
   * @param {string[]} groupNames - Array of group names
   * @param {Object} transaction - Database transaction (optional)
   * @returns {Object} Result object with success status
   */
  static async assignPermissionsByGroups(roleId, groupNames, transaction = null) {
    try {
      // Get permissions for the specified groups
      const groupPermissions = this.getPermissionsByGroups(groupNames);

      // Get or create permissions in database
      const permissionIds = [];
      for (const perm of groupPermissions) {
        let permission = await Permission.findOne({
          where: { name: perm.name },
          ...(transaction && { transaction })
        });

        if (!permission) {
          permission = await Permission.create({
            name: perm.name,
            resource: perm.resource,
            action: perm.action,
            description: perm.description
          }, {
            ...(transaction && { transaction })
          });
        }

        permissionIds.push(permission.id);
      }

      // Assign permissions to role
      return await this.assignPermissionsToRole(roleId, permissionIds, transaction);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to assign permissions by groups', 500);
    }
  }

  /**
   * Get user's permissions organized by groups
   * @param {number} userId - User ID
   * @returns {Object} Object with groups as keys and permission arrays as values
   */
  static async getUserPermissionsByGroups(userId) {
    try {
      const permissions = await this.getUserPermissions(userId);
      const groups = {};

      permissions.forEach(permission => {
        // Try to determine group from permission templates
        const templates = this.getPermissionTemplates();
        const template = templates.find(t => t.resource === permission.resource && t.action === permission.action);

        const group = template ? template.group : 'other';
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(permission);
      });

      return groups;
    } catch (error) {
      throw new AppError('Failed to get user permissions by groups', 500);
    }
  }

  /**
   * Get resource-action combinations for common permissions organized by groups
   * @returns {Array} Array of permission templates
   */
  static getPermissionTemplates() {
    return [
      // ========================================
      // VENDOR MANAGEMENT GROUP
      // ========================================
      { resource: 'vendors', action: 'create', description: 'Create new vendors', group: 'vendor_management' },
      { resource: 'vendors', action: 'read', description: 'View vendor information', group: 'vendor_management' },
      { resource: 'vendors', action: 'update', description: 'Update vendor information', group: 'vendor_management' },
      { resource: 'vendors', action: 'delete', description: 'Delete vendors', group: 'vendor_management' },
      { resource: 'vendors', action: 'approve', description: 'Approve vendor applications', group: 'vendor_management' },
      { resource: 'vendors', action: 'reject', description: 'Reject vendor applications', group: 'vendor_management' },
      { resource: 'vendors', action: 'follow', description: 'Follow/unfollow vendors', group: 'vendor_management' },

      // ========================================
      // PRODUCTS MANAGEMENT GROUP
      // ========================================
      { resource: 'products', action: 'create', description: 'Create new products', group: 'products_management' },
      { resource: 'products', action: 'read', description: 'View product information', group: 'products_management' },
      { resource: 'products', action: 'update', description: 'Update product information', group: 'products_management' },
      { resource: 'products', action: 'delete', description: 'Delete products', group: 'products_management' },
      { resource: 'products', action: 'analytics', description: 'View product analytics', group: 'products_management' },

      // Categories Management
      { resource: 'categories', action: 'create', description: 'Create new categories', group: 'products_management' },
      { resource: 'categories', action: 'read', description: 'View category information', group: 'products_management' },
      { resource: 'categories', action: 'update', description: 'Update category information', group: 'products_management' },
      { resource: 'categories', action: 'delete', description: 'Delete categories', group: 'products_management' },

      // Collections Management
      { resource: 'collections', action: 'create', description: 'Create new collections', group: 'products_management' },
      { resource: 'collections', action: 'read', description: 'View collection information', group: 'products_management' },
      { resource: 'collections', action: 'update', description: 'Update collection information', group: 'products_management' },
      { resource: 'collections', action: 'delete', description: 'Delete collections', group: 'products_management' },

      // Inventory Management
      { resource: 'inventory', action: 'read', description: 'View inventory information', group: 'products_management' },
      { resource: 'inventory', action: 'update', description: 'Update inventory levels', group: 'products_management' },
      { resource: 'inventory', action: 'manage', description: 'Manage inventory operations', group: 'products_management' },

      // Supply Management (Fixed namespace to 'supplies')
      { resource: 'supplies', action: 'create', description: 'Create supply records', group: 'products_management' },
      { resource: 'supplies', action: 'read', description: 'View supply information', group: 'products_management' },
      { resource: 'supplies', action: 'update', description: 'Update supply information', group: 'products_management' },
      { resource: 'supplies', action: 'delete', description: 'Delete supply records', group: 'products_management' },

      // Variant Management (NEW)
      { resource: 'variants', action: 'create', description: 'Create product variants and types', group: 'products_management' },
      { resource: 'variants', action: 'read', description: 'View product variants and combinations', group: 'products_management' },
      { resource: 'variants', action: 'update', description: 'Update variant stock, prices, and status', group: 'products_management' },
      { resource: 'variants', action: 'delete', description: 'Delete product variant types', group: 'products_management' },

      // ========================================
      // ORDERS AND PAYMENT GROUP
      // ========================================
      { resource: 'orders', action: 'create', description: 'Create new orders', group: 'earnings_payment' },
      { resource: 'orders', action: 'read', description: 'View order information', group: 'earnings_payment' },
      { resource: 'orders', action: 'update', description: 'Update order status', group: 'earnings_payment' },
      { resource: 'orders', action: 'delete', description: 'Delete orders', group: 'earnings_payment' },
      { resource: 'orders', action: 'cancel', description: 'Cancel orders', group: 'earnings_payment' },
      { resource: 'orders', action: 'process', description: 'Process order payments', group: 'earnings_payment' },

      // Payment Transactions
      { resource: 'payments', action: 'read', description: 'View payment transactions', group: 'earnings_payment' },
      { resource: 'payments', action: 'process', description: 'Process payments', group: 'earnings_payment' },
      { resource: 'payments', action: 'refund', description: 'Process refunds', group: 'earnings_payment' },

      // Payouts
      { resource: 'payouts', action: 'create', description: 'Create payout records', group: 'earnings_payment' },
      { resource: 'payouts', action: 'read', description: 'View payout information', group: 'earnings_payment' },
      { resource: 'payouts', action: 'update', description: 'Update payout status', group: 'earnings_payment' },
      { resource: 'payouts', action: 'process', description: 'Process vendor payouts', group: 'earnings_payment' },

      // Earnings/Analytics
      { resource: 'earnings', action: 'read', description: 'View earnings reports', group: 'earnings_payment' },
      { resource: 'earnings', action: 'export', description: 'Export earnings data', group: 'earnings_payment' },

      // ========================================
      // REVIEWS AND SUPPORT GROUP
      // ========================================
      { resource: 'reviews', action: 'create', description: 'Create product reviews', group: 'feedbacks_support' },
      { resource: 'reviews', action: 'read', description: 'View customer reviews', group: 'feedbacks_support' },
      { resource: 'reviews', action: 'update', description: 'Update review status', group: 'feedbacks_support' },
      { resource: 'reviews', action: 'delete', description: 'Delete inappropriate reviews', group: 'feedbacks_support' },
      { resource: 'reviews', action: 'moderate', description: 'Moderate review content', group: 'feedbacks_support' },

      // Support Feedback
      { resource: 'support', action: 'create', description: 'Create support tickets', group: 'feedbacks_support' },
      { resource: 'support', action: 'read', description: 'View support tickets', group: 'feedbacks_support' },
      { resource: 'support', action: 'update', description: 'Update support ticket status', group: 'feedbacks_support' },
      { resource: 'support', action: 'resolve', description: 'Resolve support tickets', group: 'feedbacks_support' },
      { resource: 'support', action: 'escalate', description: 'Escalate support tickets', group: 'feedbacks_support' },

      // ========================================
      // CONTENT MANAGEMENT GROUP (NEW)
      // ========================================
      { resource: 'journals', action: 'create', description: 'Create journal entries', group: 'content_management' },
      { resource: 'journals', action: 'read', description: 'View journal entries', group: 'content_management' },
      { resource: 'journals', action: 'update', description: 'Update journal entries', group: 'content_management' },
      { resource: 'journals', action: 'delete', description: 'Delete journal entries', group: 'content_management' },

      // ========================================
      // NOTIFICATION PANEL GROUP
      // ========================================
      { resource: 'notifications', action: 'create', description: 'Create system notifications', group: 'notification_panel' },
      { resource: 'notifications', action: 'read', description: 'View notification history', group: 'notification_panel' },
      { resource: 'notifications', action: 'update', description: 'Update notification settings', group: 'notification_panel' },
      { resource: 'notifications', action: 'delete', description: 'Delete notifications', group: 'notification_panel' },
      { resource: 'notifications', action: 'send', description: 'Send bulk notifications', group: 'notification_panel' },

      // ========================================
      // USER MANAGEMENT GROUP
      // ========================================
      { resource: 'users', action: 'create', description: 'Create new users', group: 'user_management' },
      { resource: 'users', action: 'read', description: 'View user information', group: 'user_management' },
      { resource: 'users', action: 'update', description: 'Update user information', group: 'user_management' },
      { resource: 'users', action: 'delete', description: 'Delete users', group: 'user_management' },
      { resource: 'users', action: 'manage', description: 'Manage user accounts and roles', group: 'user_management' },

      // Role Management (NEW)
      { resource: 'roles', action: 'create', description: 'Create new roles', group: 'user_management' },
      { resource: 'roles', action: 'read', description: 'View role information', group: 'user_management' },
      { resource: 'roles', action: 'update', description: 'Update role permissions', group: 'user_management' },
      { resource: 'roles', action: 'delete', description: 'Delete roles', group: 'user_management' },

      // ========================================
      // CUSTOMER FEATURES GROUP (NEW)
      // ========================================
      // Address Management
      { resource: 'addresses', action: 'create', description: 'Create delivery addresses', group: 'customer_features' },
      { resource: 'addresses', action: 'read', description: 'View saved addresses', group: 'customer_features' },
      { resource: 'addresses', action: 'update', description: 'Update address information', group: 'customer_features' },
      { resource: 'addresses', action: 'delete', description: 'Delete addresses', group: 'customer_features' },

      // Cart Management
      { resource: 'cart', action: 'create', description: 'Add items to shopping cart', group: 'customer_features' },
      { resource: 'cart', action: 'read', description: 'View cart contents', group: 'customer_features' },
      { resource: 'cart', action: 'update', description: 'Update cart item quantities', group: 'customer_features' },
      { resource: 'cart', action: 'delete', description: 'Remove items from cart', group: 'customer_features' },

      // Wishlist Management
      { resource: 'wishlist', action: 'create', description: 'Create and add to wishlists', group: 'customer_features' },
      { resource: 'wishlist', action: 'read', description: 'View wishlist contents', group: 'customer_features' },
      { resource: 'wishlist', action: 'update', description: 'Update wishlist items', group: 'customer_features' },
      { resource: 'wishlist', action: 'delete', description: 'Delete wishlists and items', group: 'customer_features' },

      // ========================================
      // ANALYTICS AND REPORTS GROUP
      // ========================================
      { resource: 'analytics', action: 'read', description: 'View analytics and reports', group: 'analytics_reports' },
      { resource: 'analytics', action: 'export', description: 'Export analytics data', group: 'analytics_reports' },
      { resource: 'analytics', action: 'dashboard', description: 'Access admin dashboard', group: 'analytics_reports' },

      // ========================================
      // SYSTEM ADMINISTRATION GROUP
      // ========================================
      { resource: 'system', action: 'manage', description: 'Manage system settings', group: 'system_admin' },
      { resource: 'system', action: 'backup', description: 'Create system backups', group: 'system_admin' },
      { resource: 'system', action: 'logs', description: 'View system logs', group: 'system_admin' },
      { resource: 'system', action: 'maintenance', description: 'Perform maintenance tasks', group: 'system_admin' },

      // Webhook Management (NEW)
      { resource: 'webhooks', action: 'create', description: 'Create webhook configurations', group: 'system_admin' },
      { resource: 'webhooks', action: 'read', description: 'View webhook logs and status', group: 'system_admin' },
      { resource: 'webhooks', action: 'update', description: 'Update webhook settings', group: 'system_admin' },
      { resource: 'webhooks', action: 'delete', description: 'Delete webhook configurations', group: 'system_admin' },
    ];
  }
}

module.exports = PermissionService;