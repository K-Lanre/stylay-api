// models/user_role.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserRole extends Model {
    static associate(models) {
      UserRole.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
      UserRole.belongsTo(models.Role, {
        foreignKey: 'role_id',
        as: 'role'
      });
    }
  }

  UserRole.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    role_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'UserRole',
    tableName: 'user_roles',
    timestamps: false,
    underscored: true
  });

  return UserRole;
};