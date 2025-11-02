'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PermissionUser extends Model {
    static associate(models) {
      PermissionUser.belongsTo(models.Permission, {
        foreignKey: 'permission_id',
        as: 'permission'
      });

      PermissionUser.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
    }
  }

  PermissionUser.init({
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
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      comment: 'ID of the user'
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
    modelName: 'PermissionUser',
    tableName: 'permission_users',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'permission_id'],
        name: 'unique_user_permission'
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['permission_id']
      }
    ]
  });

  // Class methods for PermissionUser
  PermissionUser.assignPermissionToUser = async function(permissionId, userId) {
    try {
      const [permissionUser, created] = await this.findOrCreate({
        where: {
          permission_id: permissionId,
          user_id: userId
        },
        defaults: {
          permission_id: permissionId,
          user_id: userId
        }
      });
      return { permissionUser, created };
    } catch (error) {
      throw new Error(`Failed to assign permission to user: ${error.message}`);
    }
  };

  PermissionUser.removePermissionFromUser = async function(permissionId, userId) {
    try {
      const deleted = await this.destroy({
        where: {
          permission_id: permissionId,
          user_id: userId
        }
      });
      return deleted > 0;
    } catch (error) {
      throw new Error(`Failed to remove permission from user: ${error.message}`);
    }
  };

  PermissionUser.getDirectPermissionsForUser = async function(userId) {
    try {
      const permissionUsers = await this.findAll({
        where: { user_id: userId },
        include: [
          {
            model: sequelize.models.Permission,
            as: 'permission',
            required: true
          }
        ],
        order: [['permission_id', 'ASC']]
      });

      return permissionUsers.map(pu => pu.permission);
    } catch (error) {
      throw new Error(`Failed to get direct permissions for user: ${error.message}`);
    }
  };

  PermissionUser.getUsersForPermission = async function(permissionId) {
    try {
      const permissionUsers = await this.findAll({
        where: { permission_id: permissionId },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            required: true
          }
        ],
        order: [['user_id', 'ASC']]
      });

      return permissionUsers.map(pu => pu.user);
    } catch (error) {
      throw new Error(`Failed to get users for permission: ${error.message}`);
    }
  };

  PermissionUser.userHasDirectPermission = async function(userId, permissionId) {
    try {
      const count = await this.count({
        where: {
          user_id: userId,
          permission_id: permissionId
        }
      });
      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check if user has direct permission: ${error.message}`);
    }
  };

  PermissionUser.removeAllPermissionsFromUser = async function(userId) {
    try {
      const deleted = await this.destroy({
        where: {
          user_id: userId
        }
      });
      return deleted;
    } catch (error) {
      throw new Error(`Failed to remove all permissions from user: ${error.message}`);
    }
  };

  return PermissionUser;
};
