// models/role.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    static associate(models) {
      Role.belongsToMany(models.User, {
        through: {
          model: models.UserRole,
          as: 'userRoles'
        },
        foreignKey: 'role_id',
        otherKey: 'user_id',
        as: 'users'
      });

      Role.hasMany(models.UserRole, {
        foreignKey: 'role_id',
        as: 'userRoles'
      });

      // Permission associations for role-based permissions
      Role.belongsToMany(models.Permission, {
        through: {
          model: models.PermissionRole,
          as: 'permissionRoles'
        },
        foreignKey: 'role_id',
        otherKey: 'permission_id',
        as: 'permissions'
      });

      Role.hasMany(models.PermissionRole, {
        foreignKey: 'role_id',
        as: 'permissionRoles'
      });
    }

    // Instance method to check if role has permission
    async hasPermission(permissionName) {
      if (!this.permissions) {
        return false;
      }
      return this.permissions.some(permission => permission.name === permissionName);
    }

    // Instance method to give permission to role
    async givePermission(permissionName) {
      const { Permission, PermissionRole } = sequelize.models;
      const permission = await Permission.findOne({ where: { name: permissionName } });
      
      if (!permission) {
        throw new Error(`Permission "${permissionName}" not found`);
      }

      await PermissionRole.assignPermissionToRole(permission.id, this.id);
      
      // Refresh role with updated permissions
      return await Role.findByPk(this.id, {
        include: [{
          model: Permission,
          as: 'permissions'
        }]
      });
    }

    // Instance method to revoke permission from role
    async revokePermission(permissionName) {
      const { Permission, PermissionRole } = sequelize.models;
      const permission = await Permission.findOne({ where: { name: permissionName } });
      
      if (!permission) {
        throw new Error(`Permission "${permissionName}" not found`);
      }

      return await PermissionRole.removePermissionFromRole(permission.id, this.id);
    }

    // Instance method to get all permissions for role
    async getPermissions() {
      const { PermissionRole } = sequelize.models;
      return await PermissionRole.getPermissionsForRole(this.id);
    }
  }

  Role.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'Role',
    tableName: 'roles',
    timestamps: false,
    underscored: true
  });

  return Role;
};
