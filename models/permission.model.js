'use strict';
const { Model } = require('sequelize');
const slugify = require('slugify');

module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    static associate(models) {
      // Permission belongs to many roles (many-to-many)
      Permission.belongsToMany(models.Role, {
        through: {
          model: models.PermissionRole,
          as: 'permissionRoles'
        },
        foreignKey: 'permission_id',
        otherKey: 'role_id',
        as: 'roles'
      });

      // Permission belongs to many users (many-to-many) - direct user permissions
      Permission.belongsToMany(models.User, {
        through: {
          model: models.PermissionUser,
          as: 'permissionUsers'
        },
        foreignKey: 'permission_id',
        otherKey: 'user_id',
        as: 'users'
      });

      Permission.hasMany(models.PermissionRole, {
        foreignKey: 'permission_id',
        as: 'permissionRoles'
      });

      Permission.hasMany(models.PermissionUser, {
        foreignKey: 'permission_id',
        as: 'permissionUsers'
      });
    }

    // Instance method to generate slug from name
    generateSlug() {
      if (this.name) {
        this.slug = slugify(this.name, { lower: true, strict: true });
      }
    }

    // Instance method to check if permission matches resource and action
    matches(resource, action) {
      return this.resource === resource && this.action === action;
    }

    // Instance method to get full permission name
    getFullName() {
      return `${this.resource}_${this.action}`;
    }
  }

  Permission.init({
    id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Permission name (e.g., manage_products)',
      validate: {
        notEmpty: {
          msg: 'Permission name cannot be empty'
        },
        len: {
          args: [1, 100],
          msg: 'Permission name must be between 1 and 100 characters'
        }
      }
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'URL-friendly permission name (e.g., manage-products)',
      validate: {
        notEmpty: {
          msg: 'Permission slug cannot be empty'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Human-readable description of the permission'
    },
    resource: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Resource this permission applies to (e.g., products, orders)',
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
              'support', 'dashboard', 'reports', 'settings', 'auth', 'profile',
              'phone_changes', 'cart_items', 'wishlists', 'wishlist_items',
              'variant_types', 'variant_combinations', 'webhooks', 'analytics',
              'sales', 'admin_dashboard', 'vendor_onboarding', 'supplies',
              'vendor_followers', 'user_roles'
            ]
          ],
          msg: 'Resource must be a valid system resource'
        }
      }
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Action this permission allows (e.g., create, read, update, delete)',
      validate: {
        notEmpty: {
          msg: 'Action cannot be empty'
        },
        isIn: {
          args: [
            [
              'create', 'read', 'update', 'delete', 'manage', 'view', 'list',
              'export', 'import', 'approve', 'reject', 'activate', 'deactivate',
              'archive', 'restore', 'login', 'logout', 'verify_email', 'resend_verification',
              'forgot_password', 'reset_password', 'verify_phone', 'request_phone_change',
              'cancel_phone_change', 'change_password', 'read_pending', 'read_by_id',
              'read_products', 'create_admin', 'read_summary', 'share', 'sync',
              'assign_variant', 'remove_variant', 'read_all', 'test', 'read_public',
              'read_by_identifier', 'read_by_vendor', 'read_reviews_public', 'create_vendor',
              'update_own_vendor', 'delete_own_vendor', 'manage_own_vendor', 'read_analytics_vendor',
              'read_analytics_public', 'manage_all_admin', 'delete_any_admin', 'update_status_admin',
              'read_by_status_admin', 'read_tree_public', 'read_products_public', 'read_by_identifier_public',
              'read_metrics', 'read_recent_admin', 'read_top_performing', 'read_stats_admin',
              'read_stats', 'read_overview_admin', 'read_low_stock_global_admin', 'read_history_admin',
              'read_vendor_admin', 'update_any_admin', 'read_analytics_admin', 'read_single_admin',
              'assign_admin', 'remove_admin', 'read_product_history', 'read_summary_vendor',
              'read_summary_admin', 'moderate_admin', 'respond_vendor', 'flag', 'remove_flagged_admin',
              'approve_application_admin', 'reject_application_admin', 'suspend_admin', 'activate_admin',
              'update_profile_vendor', 'delete_all', 'delete_vendor'
            ]
          ],
          msg: 'Action must be a valid permission action'
        }
      }
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
    modelName: 'Permission',
    tableName: 'permissions',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: (permission) => {
        permission.generateSlug();
      },
      beforeUpdate: (permission) => {
        if (permission.changed('name')) {
          permission.generateSlug();
        }
      }
    }
  });

  // Class methods
  Permission.findByResourceAndAction = function(resource, action) {
    return this.findOne({
      where: {
        resource,
        action
      }
    });
  };

  Permission.getPermissionsByResource = function(resource) {
    return this.findAll({
      where: { resource },
      order: [['action', 'ASC']]
    });
  };

  Permission.getPermissionsByAction = function(action) {
    return this.findAll({
      where: { action },
      order: [['resource', 'ASC']]
    });
  };

  return Permission;
};
