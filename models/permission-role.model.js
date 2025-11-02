'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PermissionRole extends Model {
    static associate(models) {
      PermissionRole.belongsTo(models.Permission, {
        foreignKey: 'permission_id',
        as: 'permission'
      });

      PermissionRole.belongsTo(models.Role, {
        foreignKey: 'role_id',
        as: 'role'
      });
    }
  }

  PermissionRole.init({
    id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    permission_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'ID of the permission'
    },
    role_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      comment: 'ID of the role'
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
    modelName: 'PermissionRole',
    tableName: 'permission_roles',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['role_id', 'permission_id'],
        name: 'unique_role_permission'
      },
      {
        fields: ['role_id']
      },
      {
        fields: ['permission_id']
      }
    ]
  });

  // Class methods for PermissionRole
  PermissionRole.assignPermissionToRole = async function(permissionId, roleId) {
    try {
      const [permissionRole, created] = await this.findOrCreate({
        where: {
          permission_id: permissionId,
          role_id: roleId
        },
        defaults: {
          permission_id: permissionId,
          role_id: roleId
        }
      });
      return { permissionRole, created };
    } catch (error) {
      throw new Error(`Failed to assign permission to role: ${error.message}`);
    }
  };

  PermissionRole.removePermissionFromRole = async function(permissionId, roleId) {
    try {
      const deleted = await this.destroy({
        where: {
          permission_id: permissionId,
          role_id: roleId
        }
      });
      return deleted > 0;
    } catch (error) {
      throw new Error(`Failed to remove permission from role: ${error.message}`);
    }
  };

  PermissionRole.getPermissionsForRole = async function(roleId) {
    try {
      const permissionRoles = await this.findAll({
        where: { role_id: roleId },
        include: [
          {
            model: sequelize.models.Permission,
            as: 'permission',
            required: true
          }
        ],
        order: [['permission_id', 'ASC']]
      });

      return permissionRoles.map(pr => pr.permission);
    } catch (error) {
      throw new Error(`Failed to get permissions for role: ${error.message}`);
    }
  };

  PermissionRole.getRolesForPermission = async function(permissionId) {
    try {
      const permissionRoles = await this.findAll({
        where: { permission_id: permissionId },
        include: [
          {
            model: sequelize.models.Role,
            as: 'role',
            required: true
          }
        ],
        order: [['role_id', 'ASC']]
      });

      return permissionRoles.map(pr => pr.role);
    } catch (error) {
      throw new Error(`Failed to get roles for permission: ${error.message}`);
    }
  };

  PermissionRole.roleHasPermission = async function(roleId, permissionId) {
    try {
      const count = await this.count({
        where: {
          role_id: roleId,
          permission_id: permissionId
        }
      });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check if role has permission: ${error.message}`);
    }
  };

  return PermissionRole;
};
