// models/vendor_product_tag.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VendorProductTag extends Model {
    static associate(models) {
      VendorProductTag.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id'
      });
      VendorProductTag.belongsTo(models.Product, {
        foreignKey: 'product_id'
      });
    }
  }

  VendorProductTag.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    vendor_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    product_id: {
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
    modelName: 'VendorProductTag',
    tableName: 'vendor_product_tags',
    timestamps: false,
    underscored: true
  });

  return VendorProductTag;
};