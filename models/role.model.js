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

      // Add permissions association
      Role.belongsToMany(models.Permission, {
        through: models.RolePermission,
        foreignKey: 'role_id',
        otherKey: 'permission_id',
        as: 'permissions'
      });

      Role.hasMany(models.RolePermission, {
        foreignKey: 'role_id',
        as: 'rolePermissions'
      });
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
