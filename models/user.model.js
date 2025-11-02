// models/user.js
'use strict';
const bcrypt = require('bcryptjs');
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Address, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Notification, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Order, {
        foreignKey: 'user_id',
        as: 'orders'
      });
      User.hasMany(models.Review, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.SupportFeedback, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.OversightLog, {
        foreignKey: 'admin_id'
      });
      User.hasMany(models.PaymentTransaction, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Vendor, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Vendor, {
        foreignKey: 'approved_by',
        as: 'approved_vendors'
      });
      User.belongsToMany(models.Role, {
        through: {
          model: models.UserRole,
          as: 'userRoles'
        },
        foreignKey: 'user_id',
        otherKey: 'role_id',
        as: 'roles'
      });
      
      User.hasMany(models.UserRole, {
        foreignKey: 'user_id',
        as: 'userRoles'
      });
      User.hasMany(models.VendorFollower, {
        foreignKey: 'user_id',
        as: 'following'
      });

      // User can have multiple carts (for cart history)
      User.hasMany(models.Cart, {
        foreignKey: 'user_id',
        as: 'carts'
      });

      // User has one active cart (convenience association)
      User.hasOne(models.Cart, {
        foreignKey: 'user_id',
        as: 'activeCart',
        scope: {
          status: 'active'
        }
      });

      // Permission associations for direct user permissions
      User.belongsToMany(models.Permission, {
        through: {
          model: models.PermissionUser,
          as: 'permissionUsers'
        },
        foreignKey: 'user_id',
        otherKey: 'permission_id',
        as: 'directPermissions'
      });

      User.hasMany(models.PermissionUser, {
        foreignKey: 'user_id',
        as: 'permissionUsers'
      });

    }

  }

  User.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'User\'s date of birth',
      validate: {
        isDate: {
          msg: 'Please provide a valid date of birth'
        },
        isBefore: new Date().toISOString().split('T')[0],
        isAfter: '1900-01-01'
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true
    },
    email_verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    email_verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    email_verification_token_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    password_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_changed_at'
    },
    pending_phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    phone_change_requested_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    phone_change_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    phone_change_token_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: 1
    },
    profile_image: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true
  });

  // Instance method to check if password was changed after a specific timestamp
  User.prototype.changedPasswordAfter = function(JWTTimestamp) {
    if (this.password_changed_at) {
      const changedTimestamp = parseInt(
        this.password_changed_at.getTime() / 1000,
        10
      );
      return JWTTimestamp < changedTimestamp;
    }
    // False means NOT changed
    return false;
  };

  // Add instance methods to User prototype
  User.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  };

  /**
   * Check if verification token is expired
   * @returns {Object} Returns an object with status and message
   * @property {boolean} isExpired - Whether the token is expired
   * @property {string} message - Human-readable message about token status
   * @property {Date|null} expiresAt - When the token expires (null if no expiration set)
   */
  User.prototype.getTokenStatus = function() {
    if (!this.email_verification_token_expires) {
      return {
        isExpired: true,
        message: 'No verification token found. Please request a new verification code.',
        expiresAt: null
      };
    }

    const now = new Date();
    const isExpired = now > this.email_verification_token_expires;
    
    if (isExpired) {
      return {
        isExpired: true,
        message: 'Verification code has expired. Please request a new one.',
        expiresAt: this.email_verification_token_expires
      };
    }

    // Calculate remaining time in minutes
    const remainingMinutes = Math.ceil((this.email_verification_token_expires - now) / (1000 * 60));
    
    return {
      isExpired: false,
      message: `Verification code is valid for ${remainingMinutes} more minute${remainingMinutes !== 1 ? 's' : ''}.`,
      expiresAt: this.email_verification_token_expires
    };
  };

  // For backward compatibility
  User.prototype.isVerificationTokenExpired = function() {
    return this.getTokenStatus().isExpired;
  };

  /**
   * Check if phone change token is expired
   * @returns {Object} Returns an object with status and message
   * @property {boolean} isExpired - Whether the token is expired
   * @property {string} message - Human-readable message about token status
   * @property {Date|null} expiresAt - When the token expires (null if no expiration set)
   */
  User.prototype.getPhoneChangeTokenStatus = function() {
    if (!this.phone_change_token_expires) {
      return {
        isExpired: true,
        message: 'No phone change token found.',
        expiresAt: null
      };
    }

    const now = new Date();
    const isExpired = now > this.phone_change_token_expires;

    if (isExpired) {
      return {
        isExpired: true,
        message: 'Phone change verification link has expired.',
        expiresAt: this.phone_change_token_expires
      };
    }

    // Calculate remaining time in hours
    const remainingHours = Math.ceil((this.phone_change_token_expires - now) / (1000 * 60 * 60));

    return {
      isExpired: false,
      message: `Phone change verification link is valid for ${remainingHours} more hour${remainingHours !== 1 ? 's' : ''}.`,
      expiresAt: this.phone_change_token_expires
    };
  };

  /**
   * Check if phone change is in verification period
   * @returns {boolean} True if phone change is pending verification
   */
  User.prototype.isPhoneChangePending = function() {
    return !!(this.pending_phone_number && this.phone_change_requested_at);
  };

  /**
   * Check if verification period has expired (24 hours)
   * @returns {boolean} True if verification period has expired
   */
  User.prototype.isPhoneChangeVerificationExpired = function() {
    if (!this.phone_change_requested_at) return false;

    const now = new Date();
    const verificationPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const timeSinceRequest = now - this.phone_change_requested_at;

    return timeSinceRequest > verificationPeriod;
  };

  /**
   * Check if user has a specific role
   * @param {string} roleName - The name of the role to check
   * @returns {boolean} True if user has the role
   */
  User.prototype.hasRole = async function(roleName) {
    if (!this.roles || this.roles.length === 0) {
      return false;
    }
    return this.roles.some(role => role.name === roleName);
  };

  /**
   * Check if user has any of the specified roles
   * @param {Array<string>} roleNames - Array of role names to check
   * @returns {boolean} True if user has at least one of the roles
   */
  User.prototype.hasAnyRole = async function(roleNames) {
    if (!this.roles || this.roles.length === 0) {
      return false;
    }
    return this.roles.some(role => roleNames.includes(role.name));
  };

  /**
   * Check if user has all of the specified roles
   * @param {Array<string>} roleNames - Array of role names to check
   * @returns {boolean} True if user has all of the roles
   */
  User.prototype.hasAllRoles = async function(roleNames) {
    if (!this.roles || this.roles.length === 0) {
      return false;
    }
    return this.roles.every(role => roleNames.includes(role.name));
  };

  /**
   * Check if user is admin
   * @returns {boolean} True if user has admin role
   */
  User.prototype.isAdmin = async function() {
    return await this.hasRole('admin');
  };

  /**
   * Check if user is vendor
   * @returns {boolean} True if user has vendor role
   */
  User.prototype.isVendor = async function() {
    return await this.hasRole('vendor');
  };

  /**
   * Check if user is customer
   * @returns {boolean} True if user has customer role
   */
  User.prototype.isCustomer = async function() {
    return await this.hasRole('customer');
  };

  // ===== PERMISSION METHODS =====

  /**
   * Check if user has a specific permission (role-based or direct)
   * @param {string} permissionName - The name of the permission to check
   * @returns {Promise<boolean>} True if user has the permission
   */
  User.prototype.hasPermission = async function(permissionName) {
    try {
      const PermissionService = require('../services/permission.service');
      return await PermissionService.hasPermission(this.id, permissionName);
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  };

  /**
   * Check if user has permission for a specific resource and action
   * @param {string} resource - Resource name (e.g., 'products', 'orders')
   * @param {string} action - Action name (e.g., 'create', 'read', 'update', 'delete')
   * @returns {Promise<boolean>} True if user has the permission
   */
  User.prototype.hasPermissionTo = async function(resource, action) {
    try {
      const PermissionService = require('../services/permission.service');
      return await PermissionService.hasPermissionTo(this.id, resource, action);
    } catch (error) {
      console.error('Error checking user permission for resource/action:', error);
      return false;
    }
  };

  /**
   * Check if user has any of the specified permissions
   * @param {Array<string>} permissionNames - Array of permission names to check
   * @returns {Promise<boolean>} True if user has at least one of the permissions
   */
  User.prototype.hasAnyPermission = async function(permissionNames) {
    try {
      if (!permissionNames || permissionNames.length === 0) {
        return false;
      }

      const userPermissions = await this.getAllPermissions();
      const userPermissionNames = userPermissions.map(p => p.name);
      
      return permissionNames.some(permission => userPermissionNames.includes(permission));
    } catch (error) {
      console.error('Error checking user any permissions:', error);
      return false;
    }
  };

  /**
   * Check if user has all of the specified permissions
   * @param {Array<string>} permissionNames - Array of permission names to check
   * @returns {Promise<boolean>} True if user has all of the permissions
   */
  User.prototype.hasAllPermissions = async function(permissionNames) {
    try {
      if (!permissionNames || permissionNames.length === 0) {
        return false;
      }

      const userPermissions = await this.getAllPermissions();
      const userPermissionNames = userPermissions.map(p => p.name);
      
      return permissionNames.every(permission => userPermissionNames.includes(permission));
    } catch (error) {
      console.error('Error checking user all permissions:', error);
      return false;
    }
  };

  /**
   * Grant permission directly to user (bypassing roles)
   * @param {string|Object} permission - Permission name or permission object
   * @returns {Promise<Object>} Result object with success status
   */
  User.prototype.givePermissionTo = async function(permission) {
    try {
      const PermissionService = require('../services/permission.service');
      
      let permissionId;
      if (typeof permission === 'object' && permission.id) {
        permissionId = permission.id;
      } else if (typeof permission === 'string') {
        // Find permission by name
        const { Permission } = require('../models');
        const permissionObj = await Permission.findOne({ where: { name: permission } });
        if (!permissionObj) {
          throw new Error(`Permission "${permission}" not found`);
        }
        permissionId = permissionObj.id;
      } else {
        throw new Error('Invalid permission provided');
      }

      const result = await PermissionService.assignPermissionToUser(permissionId, this.id);
      return { success: true, created: result.created };
    } catch (error) {
      console.error('Error giving permission to user:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Revoke permission directly from user
   * @param {string|Object} permission - Permission name or permission object
   * @returns {Promise<Object>} Result object with success status
   */
  User.prototype.revokePermissionTo = async function(permission) {
    try {
      const PermissionService = require('../services/permission.service');
      
      let permissionId;
      if (typeof permission === 'object' && permission.id) {
        permissionId = permission.id;
      } else if (typeof permission === 'string') {
        // Find permission by name
        const { Permission } = require('../models');
        const permissionObj = await Permission.findOne({ where: { name: permission } });
        if (!permissionObj) {
          throw new Error(`Permission "${permission}" not found`);
        }
        permissionId = permissionObj.id;
      } else {
        throw new Error('Invalid permission provided');
      }

      const success = await PermissionService.removePermissionFromUser(permissionId, this.id);
      return { success };
    } catch (error) {
      console.error('Error revoking permission from user:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Quick check for resource-action permission (like Laravel's can() method)
   * @param {string} resource - Resource name
   * @param {string} action - Action name
   * @returns {Promise<boolean>} True if user can perform the action
   */
  User.prototype.can = async function(resource, action) {
    return await this.hasPermissionTo(resource, action);
  };

  /**
   * Get all permissions for user (role-based + direct assignments)
   * @returns {Promise<Array>} Array of permission objects
   */
  User.prototype.getAllPermissions = async function() {
    try {
      const PermissionService = require('../services/permission.service');
      return await PermissionService.getUserPermissions(this.id);
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  };

  /**
   * Get only direct permissions assigned to user (not through roles)
   * @returns {Promise<Array>} Array of direct permission objects
   */
  User.prototype.getDirectPermissions = async function() {
    try {
      const PermissionService = require('../services/permission.service');
      return await PermissionService.getUserDirectPermissions(this.id);
    } catch (error) {
      console.error('Error getting user direct permissions:', error);
      return [];
    }
  };

  /**
   * Get all role-based permissions for user
   * @returns {Promise<Array>} Array of role-based permission objects
   */
  User.prototype.getRolePermissions = async function() {
    try {
      if (!this.roles || this.roles.length === 0) {
        return [];
      }

      const { PermissionRole } = require('../models');
      const roleIds = this.roles.map(role => role.id);
      
      // Get permissions for all user roles
      const allRolePermissions = [];
      for (const roleId of roleIds) {
        const rolePermissions = await PermissionRole.getPermissionsForRole(roleId);
        allRolePermissions.push(...rolePermissions);
      }

      // Remove duplicates
      const uniquePermissions = allRolePermissions.filter((permission, index, self) =>
        index === self.findIndex(p => p.id === permission.id)
      );

      return uniquePermissions;
    } catch (error) {
      console.error('Error getting user role permissions:', error);
      return [];
    }
  };

  /**
   * Check if user has permission through any of their roles
   * @param {string} permissionName - Permission name to check
   * @returns {Promise<boolean>} True if user has permission through roles
   */
  User.prototype.hasRolePermission = async function(permissionName) {
    try {
      const rolePermissions = await this.getRolePermissions();
      return rolePermissions.some(permission => permission.name === permissionName);
    } catch (error) {
      console.error('Error checking user role permission:', error);
      return false;
    }
  };

  /**
   * Check if user has direct permission (not through roles)
   * @param {string} permissionName - Permission name to check
   * @returns {Promise<boolean>} True if user has direct permission
   */
  User.prototype.hasDirectPermission = async function(permissionName) {
    try {
      const directPermissions = await this.getDirectPermissions();
      return directPermissions.some(permission => permission.name === permissionName);
    } catch (error) {
      console.error('Error checking user direct permission:', error);
      return false;
    }
  };

  /**
   * Remove all direct permissions from user
   * @returns {Promise<Object>} Result object with count of removed permissions
   */
  User.prototype.removeAllDirectPermissions = async function() {
    try {
      const { PermissionUser } = require('../models');
      const count = await PermissionUser.removeAllPermissionsFromUser(this.id);
      return { success: true, count };
    } catch (error) {
      console.error('Error removing all direct permissions from user:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Get user's permission names as array (for performance)
   * @returns {Promise<Array>} Array of permission names
   */
  User.prototype.getPermissionNames = async function() {
    try {
      const permissions = await this.getAllPermissions();
      return permissions.map(p => p.name);
    } catch (error) {
      console.error('Error getting user permission names:', error);
      return [];
    }
  };

  /**
   * Get user's permission cache key for caching purposes
   * @returns {string} Cache key for user permissions
   */
  User.prototype.getPermissionCacheKey = function() {
    return `user_permissions_${this.id}`;
  };

  return User;
};
