'use strict';

const { Permission, PermissionRole, PermissionUser, Role, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class PermissionService {
  /**
   * Create a new permission
   * @param {Object} permissionData - Permission data
   * @returns {Promise<Permission>} Created permission
   */
  static async createPermission(permissionData) {
    try {
      const { name, description, resource, action } = permissionData;

      // Check if permission already exists
      const existingPermission = await Permission.findOne({
        where: { name }
      });

      if (existingPermission) {
        throw new Error(`Permission with name "${name}" already exists`);
      }

      // Validate resource and action
      const validResources = [
        'users', 'roles', 'permissions', 'products', 'categories', 'orders',
        'inventory', 'reviews', 'vendors', 'addresses', 'payments', 'carts',
        'collections', 'journals', 'variants', 'supply', 'notifications',
        'support', 'dashboard', 'reports', 'settings'
      ];

      const validActions = [
        'create', 'read', 'update', 'delete', 'manage', 'view', 'list',
        'export', 'import', 'approve', 'reject', 'activate', 'deactivate',
        'archive', 'restore'
      ];

      if (!validResources.includes(resource)) {
        throw new Error(`Invalid resource: ${resource}`);
      }

      if (!validActions.includes(action)) {
        throw new Error(`Invalid action: ${action}`);
      }

      const permission = await Permission.create({
        name,
        description,
        resource,
        action
      });

      logger.info(`Permission created: ${permission.name}`);
      return permission;
    } catch (error) {
      logger.error('Error creating permission:', error);
      throw new Error(`Failed to create permission: ${error.message}`);
    }
  }

  /**
   * Get all permissions with optional filtering and pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated permissions
   */
  static async getAllPermissions(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        resource,
        action,
        search,
        sortBy = 'name',
        sortOrder = 'ASC'
      } = options;

      const offset = (page - 1) * limit;
      const where = {};

      if (resource) {
        where.resource = resource;
      }

      if (action) {
        where.action = action;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { resource: { [Op.like]: `%${search}%` } }
        ];
      }

      const { count, rows: permissions } = await Permission.findAndCountAll({
        where,
        limit,
        offset,
        order: [[sortBy, sortOrder]],
        include: [
          {
            model: Role,
            as: 'roles',
            through: { attributes: [] },
            required: false
          }
        ]
      });

      const totalPages = Math.ceil(count / limit);

      return {
        permissions,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: count,
          total_pages: totalPages,
          has_next_page: page < totalPages,
          has_previous_page: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting permissions:', error);
      throw new Error(`Failed to get permissions: ${error.message}`);
    }
  }

  /**
   * Get permission by ID
   * @param {number} id - Permission ID
   * @returns {Promise<Permission>} Permission object
   */
  static async getPermission(id) {
    try {
      const permission = await Permission.findByPk(id, {
        include: [
          {
            model: Role,
            as: 'roles',
            through: { attributes: [] },
            required: false
          },
          {
            model: User,
            as: 'users',
            through: { attributes: [] },
            required: false
          }
        ]
      });

      if (!permission) {
        throw new Error(`Permission with ID ${id} not found`);
      }

      return permission;
    } catch (error) {
      logger.error(`Error getting permission ${id}:`, error);
      throw new Error(`Failed to get permission: ${error.message}`);
    }
  }

  /**
   * Update permission
   * @param {number} id - Permission ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Permission>} Updated permission
   */
  static async updatePermission(id, updateData) {
    try {
      const permission = await Permission.findByPk(id);

      if (!permission) {
        throw new Error(`Permission with ID ${id} not found`);
      }

      // If name is being updated, check for uniqueness
      if (updateData.name && updateData.name !== permission.name) {
        const existingPermission = await Permission.findOne({
          where: { name: updateData.name }
        });

        if (existingPermission) {
          throw new Error(`Permission with name "${updateData.name}" already exists`);
        }
      }

      await permission.update(updateData);

      logger.info(`Permission updated: ${permission.name}`);
      return permission;
    } catch (error) {
      logger.error(`Error updating permission ${id}:`, error);
      throw new Error(`Failed to update permission: ${error.message}`);
    }
  }

  /**
   * Delete permission
   * @param {number} id - Permission ID
   * @returns {Promise<boolean>} Success status
   */
  static async deletePermission(id) {
    try {
      const permission = await Permission.findByPk(id);

      if (!permission) {
        throw new Error(`Permission with ID ${id} not found`);
      }

      // Remove all role associations
      await PermissionRole.destroy({
        where: { permission_id: id }
      });

      // Remove all user associations
      await PermissionUser.destroy({
        where: { permission_id: id }
      });

      // Delete the permission
      await permission.destroy();

      logger.info(`Permission deleted: ${permission.name}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting permission ${id}:`, error);
      throw new Error(`Failed to delete permission: ${error.message}`);
    }
  }

  /**
   * Assign permission to role
   * @param {number} permissionId - Permission ID
   * @param {number} roleId - Role ID
   * @returns {Promise<Object>} Assignment result
   */
  static async assignPermissionToRole(permissionId, roleId) {
    try {
      const permission = await Permission.findByPk(permissionId);
      const role = await Role.findByPk(roleId);

      if (!permission) {
        throw new Error(`Permission with ID ${permissionId} not found`);
      }

      if (!role) {
        throw new Error(`Role with ID ${roleId} not found`);
      }

      const result = await PermissionRole.assignPermissionToRole(permissionId, roleId);

      if (result.created) {
        logger.info(`Permission ${permission.name} assigned to role ${role.name}`);
      }

      return result;
    } catch (error) {
      logger.error('Error assigning permission to role:', error);
      throw new Error(`Failed to assign permission to role: ${error.message}`);
    }
  }

  /**
   * Remove permission from role
   * @param {number} permissionId - Permission ID
   * @param {number} roleId - Role ID
   * @returns {Promise<boolean>} Success status
   */
  static async removePermissionFromRole(permissionId, roleId) {
    try {
      const permission = await Permission.findByPk(permissionId);
      const role = await Role.findByPk(roleId);

      if (!permission) {
        throw new Error(`Permission with ID ${permissionId} not found`);
      }

      if (!role) {
        throw new Error(`Role with ID ${roleId} not found`);
      }

      const success = await PermissionRole.removePermissionFromRole(permissionId, roleId);

      if (success) {
        logger.info(`Permission ${permission.name} removed from role ${role.name}`);
      }

      return success;
    } catch (error) {
      logger.error('Error removing permission from role:', error);
      throw new Error(`Failed to remove permission from role: ${error.message}`);
    }
  }

  /**
   * Assign permission to user directly
   * @param {number} permissionId - Permission ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Assignment result
   */
  static async assignPermissionToUser(permissionId, userId) {
    try {
      const permission = await Permission.findByPk(permissionId);
      const user = await User.findByPk(userId);

      if (!permission) {
        throw new Error(`Permission with ID ${permissionId} not found`);
      }

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      const result = await PermissionUser.assignPermissionToUser(permissionId, userId);

      if (result.created) {
        logger.info(`Permission ${permission.name} assigned to user ${user.email}`);
      }

      return result;
    } catch (error) {
      logger.error('Error assigning permission to user:', error);
      throw new Error(`Failed to assign permission to user: ${error.message}`);
    }
  }

  /**
   * Remove permission from user
   * @param {number} permissionId - Permission ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async removePermissionFromUser(permissionId, userId) {
    try {
      const permission = await Permission.findByPk(permissionId);
      const user = await User.findByPk(userId);

      if (!permission) {
        throw new Error(`Permission with ID ${permissionId} not found`);
      }

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      const success = await PermissionUser.removePermissionFromUser(permissionId, userId);

      if (success) {
        logger.info(`Permission ${permission.name} removed from user ${user.email}`);
      }

      return success;
    } catch (error) {
      logger.error('Error removing permission from user:', error);
      throw new Error(`Failed to remove permission from user: ${error.message}`);
    }
  }

  /**
   * Get all permissions for a user (role-based + direct)
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of permissions
   */
  static async getUserPermissions(userId) {
    try {
      // Get role-based permissions
      const rolePermissions = await PermissionRole.getPermissionsForRole(
        // First get user's roles
        (await User.findByPk(userId, {
          include: [{
            model: Role,
            as: 'roles',
            through: { attributes: [] }
          }]
        })).roles.map(role => role.id)
      );

      // Get direct user permissions
      const directPermissions = await PermissionUser.getDirectPermissionsForUser(userId);

      // Combine and deduplicate
      const allPermissions = [...rolePermissions, ...directPermissions];
      const uniquePermissions = allPermissions.filter((permission, index, self) =>
        index === self.findIndex(p => p.id === permission.id)
      );

      return uniquePermissions;
    } catch (error) {
      logger.error(`Error getting user permissions for user ${userId}:`, error);
      throw new Error(`Failed to get user permissions: ${error.message}`);
    }
  }

  /**
   * Check if user has permission
   * @param {number} userId - User ID
   * @param {string} permissionName - Permission name
   * @returns {Promise<boolean>} Has permission
   */
  static async hasPermission(userId, permissionName) {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return userPermissions.some(permission => permission.name === permissionName);
    } catch (error) {
      logger.error(`Error checking user permission for user ${userId}:`, error);
      throw new Error(`Failed to check user permission: ${error.message}`);
    }
  }

  /**
   * Check if user has permission for resource and action
   * @param {number} userId - User ID
   * @param {string} resource - Resource name
   * @param {string} action - Action name
   * @returns {Promise<boolean>} Has permission
   */
  static async hasPermissionTo(userId, resource, action) {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return userPermissions.some(permission => 
        permission.resource === resource && permission.action === action
      );
    } catch (error) {
      logger.error(`Error checking user permission for user ${userId}:`, error);
      throw new Error(`Failed to check user permission: ${error.message}`);
    }
  }

  /**
   * Get role permissions
   * @param {number} roleId - Role ID
   * @returns {Promise<Array>} Array of permissions
   */
  static async getRolePermissions(roleId) {
    try {
      return await PermissionRole.getPermissionsForRole(roleId);
    } catch (error) {
      logger.error(`Error getting role permissions for role ${roleId}:`, error);
      throw new Error(`Failed to get role permissions: ${error.message}`);
    }
  }

  /**
   * Get user direct permissions
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of direct permissions
   */
  static async getUserDirectPermissions(userId) {
    try {
      return await PermissionUser.getDirectPermissionsForUser(userId);
    } catch (error) {
      logger.error(`Error getting user direct permissions for user ${userId}:`, error);
      throw new Error(`Failed to get user direct permissions: ${error.message}`);
    }
  }

  /**
   * Assign multiple permissions to role
   * @param {number} roleId - Role ID
   * @param {Array} permissionIds - Array of permission IDs
   * @returns {Promise<Object>} Assignment results
   */
  static async assignMultiplePermissionsToRole(roleId, permissionIds) {
    try {
      const role = await Role.findByPk(roleId);

      if (!role) {
        throw new Error(`Role with ID ${roleId} not found`);
      }

      let assignedCount = 0;
      let skippedCount = 0;
      const results = [];

      // Validate all permission IDs exist
      const validPermissions = await Permission.findAll({
        where: { id: permissionIds }
      });

      const validPermissionIds = validPermissions.map(p => p.id);
      const invalidPermissionIds = permissionIds.filter(id => !validPermissionIds.includes(id));

      if (invalidPermissionIds.length > 0) {
        throw new Error(`Invalid permission IDs: ${invalidPermissionIds.join(', ')}`);
      }

      // Process each permission assignment
      for (const permissionId of permissionIds) {
        try {
          const permission = await Permission.findByPk(permissionId);
          const result = await PermissionRole.assignPermissionToRole(permissionId, roleId);

          if (result.created) {
            assignedCount++;
            logger.info(`Permission ${permission.name} assigned to role ${role.name}`);
          } else {
            skippedCount++;
            logger.info(`Permission ${permission.name} already assigned to role ${role.name}`);
          }

          results.push({
            permission_id: permissionId,
            permission_name: permission.name,
            action: result.created ? 'assigned' : 'skipped'
          });
        } catch (error) {
          logger.error(`Error assigning permission ${permissionId} to role ${roleId}:`, error);
          results.push({
            permission_id: permissionId,
            action: 'error',
            error: error.message
          });
        }
      }

      return {
        assignedCount,
        skippedCount,
        total: permissionIds.length,
        results
      };
    } catch (error) {
      logger.error(`Error assigning multiple permissions to role ${roleId}:`, error);
      throw new Error(`Failed to assign multiple permissions to role: ${error.message}`);
    }
  }

  /**
   * Remove multiple permissions from role
   * @param {number} roleId - Role ID
   * @param {Array} permissionIds - Array of permission IDs
   * @returns {Promise<Object>} Removal results
   */
  static async removeMultiplePermissionsFromRole(roleId, permissionIds) {
    try {
      const role = await Role.findByPk(roleId);

      if (!role) {
        throw new Error(`Role with ID ${roleId} not found`);
      }

      let removedCount = 0;
      let notFoundCount = 0;
      const results = [];

      // Validate all permission IDs exist
      const validPermissions = await Permission.findAll({
        where: { id: permissionIds }
      });

      const validPermissionIds = validPermissions.map(p => p.id);
      const invalidPermissionIds = permissionIds.filter(id => !validPermissionIds.includes(id));

      if (invalidPermissionIds.length > 0) {
        throw new Error(`Invalid permission IDs: ${invalidPermissionIds.join(', ')}`);
      }

      // Process each permission removal
      for (const permissionId of permissionIds) {
        try {
          const permission = await Permission.findByPk(permissionId);
          const success = await PermissionRole.removePermissionFromRole(permissionId, roleId);

          if (success) {
            removedCount++;
            logger.info(`Permission ${permission.name} removed from role ${role.name}`);
          } else {
            notFoundCount++;
            logger.info(`Permission ${permission.name} not assigned to role ${role.name}`);
          }

          results.push({
            permission_id: permissionId,
            permission_name: permission.name,
            action: success ? 'removed' : 'not_found'
          });
        } catch (error) {
          logger.error(`Error removing permission ${permissionId} from role ${roleId}:`, error);
          results.push({
            permission_id: permissionId,
            action: 'error',
            error: error.message
          });
        }
      }

      return {
        removedCount,
        notFoundCount,
        total: permissionIds.length,
        results
      };
    } catch (error) {
      logger.error(`Error removing multiple permissions from role ${roleId}:`, error);
      throw new Error(`Failed to remove multiple permissions from role: ${error.message}`);
    }
  }

  /**
   * Seed default permissions into database
   * @returns {Promise<Array>} Created permissions
   */
  static async seedDefaultPermissions() {
    try {
      const defaultPermissions = [
        // User Management
        { name: 'create_user', description: 'Create new user accounts', resource: 'users', action: 'create' },
        { name: 'read_user', description: 'View user information', resource: 'users', action: 'read' },
        { name: 'update_user', description: 'Update user information', resource: 'users', action: 'update' },
        { name: 'delete_user', description: 'Delete user accounts', resource: 'users', action: 'delete' },
        
        // Role Management
        { name: 'create_role', description: 'Create new roles', resource: 'roles', action: 'create' },
        { name: 'read_role', description: 'View role information', resource: 'roles', action: 'read' },
        { name: 'update_role', description: 'Update role information', resource: 'roles', action: 'update' },
        { name: 'delete_role', description: 'Delete roles', resource: 'roles', action: 'delete' },
        
        // Permission Management
        { name: 'create_permission', description: 'Create new permissions', resource: 'permissions', action: 'create' },
        { name: 'read_permission', description: 'View permission information', resource: 'permissions', action: 'read' },
        { name: 'update_permission', description: 'Update permission information', resource: 'permissions', action: 'update' },
        { name: 'delete_permission', description: 'Delete permissions', resource: 'permissions', action: 'delete' },
        
        // Product Management
        { name: 'create_product', description: 'Create new products', resource: 'products', action: 'create' },
        { name: 'read_product', description: 'View product information', resource: 'products', action: 'read' },
        { name: 'update_product', description: 'Update product information', resource: 'products', action: 'update' },
        { name: 'delete_product', description: 'Delete products', resource: 'products', action: 'delete' },
        { name: 'manage_product', description: 'Full product management access', resource: 'products', action: 'manage' },
        
        // Order Management
        { name: 'create_order', description: 'Create new orders', resource: 'orders', action: 'create' },
        { name: 'read_order', description: 'View order information', resource: 'orders', action: 'read' },
        { name: 'update_order', description: 'Update order information', resource: 'orders', action: 'update' },
        { name: 'delete_order', description: 'Delete orders', resource: 'orders', action: 'delete' },
        { name: 'manage_order', description: 'Full order management access', resource: 'orders', action: 'manage' },
        
        // Inventory Management
        { name: 'read_inventory', description: 'View inventory information', resource: 'inventory', action: 'read' },
        { name: 'update_inventory', description: 'Update inventory information', resource: 'inventory', action: 'update' },
        { name: 'manage_inventory', description: 'Full inventory management access', resource: 'inventory', action: 'manage' },
        
        // Vendor Management
        { name: 'create_vendor', description: 'Create new vendors', resource: 'vendors', action: 'create' },
        { name: 'read_vendor', description: 'View vendor information', resource: 'vendors', action: 'read' },
        { name: 'update_vendor', description: 'Update vendor information', resource: 'vendors', action: 'update' },
        { name: 'delete_vendor', description: 'Delete vendors', resource: 'vendors', action: 'delete' },
        { name: 'manage_vendor', description: 'Full vendor management access', resource: 'vendors', action: 'manage' },
        
        // Dashboard & Reports
        { name: 'view_dashboard', description: 'Access dashboard', resource: 'dashboard', action: 'view' },
        { name: 'view_reports', description: 'View system reports', resource: 'reports', action: 'view' },
        { name: 'export_reports', description: 'Export system reports', resource: 'reports', action: 'export' },
        
        // System Settings
        { name: 'manage_settings', description: 'Manage system settings', resource: 'settings', action: 'manage' }
      ];

      const createdPermissions = [];

      for (const permissionData of defaultPermissions) {
        try {
          // Check if permission already exists
          const existingPermission = await Permission.findOne({
            where: { name: permissionData.name }
          });

          if (!existingPermission) {
            const permission = await this.createPermission(permissionData);
            createdPermissions.push(permission);
          } else {
            logger.info(`Permission ${permissionData.name} already exists, skipping...`);
          }
        } catch (error) {
          logger.error(`Error creating default permission ${permissionData.name}:`, error);
          // Continue with other permissions even if one fails
        }
      }

      logger.info(`Created ${createdPermissions.length} default permissions`);
      return createdPermissions;
    } catch (error) {
      logger.error('Error seeding default permissions:', error);
      throw new Error(`Failed to seed default permissions: ${error.message}`);
    }
  }

  /**
   * Assign default permissions to roles
   * @returns {Promise<Object>} Assignment results
   */
  static async assignDefaultPermissionsToRoles() {
    try {
      const results = [];

      // Define default role-permission assignments
      const defaultAssignments = {
        admin: ['create_user', 'read_user', 'update_user', 'delete_user',
               'create_role', 'read_role', 'update_role', 'delete_role',
               'create_permission', 'read_permission', 'update_permission', 'delete_permission',
               'create_product', 'read_product', 'update_product', 'delete_product', 'manage_product',
               'create_order', 'read_order', 'update_order', 'delete_order', 'manage_order',
               'read_inventory', 'update_inventory', 'manage_inventory',
               'create_vendor', 'read_vendor', 'update_vendor', 'delete_vendor', 'manage_vendor',
               'view_dashboard', 'view_reports', 'export_reports', 'manage_settings'],
        
        vendor: ['read_product', 'update_product', 'manage_product',
                'read_order', 'update_order', 'manage_order',
                'read_inventory', 'update_inventory', 'manage_inventory',
                'create_vendor', 'read_vendor', 'update_vendor',
                'view_dashboard'],
        
        customer: ['read_product', 'create_order', 'read_order', 'read_vendor']
      };

      // Get all roles
      const roles = await Role.findAll();

      for (const role of roles) {
        const roleName = role.name.toLowerCase();
        const permissionsForRole = defaultAssignments[roleName];

        if (permissionsForRole) {
          // Find permissions by name
          const permissions = await Permission.findAll({
            where: { name: permissionsForRole }
          });

          // Assign each permission to the role
          const permissionIds = permissions.map(p => p.id);
          if (permissionIds.length > 0) {
            const bulkResult = await this.assignMultiplePermissionsToRole(role.id, permissionIds);
            results.push({
              role_id: role.id,
              role_name: role.name,
              ...bulkResult
            });
          }
        }
      }

      logger.info('Default permissions assigned to roles');
      return results;
    } catch (error) {
      logger.error('Error assigning default permissions to roles:', error);
      throw new Error(`Failed to assign default permissions to roles: ${error.message}`);
    }
  }
}

module.exports = PermissionService;
