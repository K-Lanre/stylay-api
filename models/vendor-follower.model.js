// models/vendor-follower.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VendorFollower extends Model {
    static associate(models) {
      VendorFollower.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'follower'
      });
      VendorFollower.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id',
        as: 'vendor'
      });
    }
  }

  VendorFollower.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      comment: 'ID of the user who is following'
    },
    vendor_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      comment: 'ID of the vendor being followed'
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
    modelName: 'VendorFollower',
    tableName: 'vendor_followers',
    timestamps: false,
    underscored: true
  });

  return VendorFollower;
};
