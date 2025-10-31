// models/supply.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Supply extends Model {
    static associate(models) {
      Supply.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id'
      });
      Supply.belongsTo(models.Product, {
        foreignKey: 'product_id'
      });
      Supply.belongsTo(models.VendorProductTag, {
        foreignKey: 'vendor_product_tag_id',
        as: 'vendorProductTag'
      });
      Supply.belongsTo(models.VariantCombination, {
        foreignKey: 'combination_id',
        as: 'variantCombination'
      });
      Supply.hasOne(models.Inventory, {
        foreignKey: 'supply_id'
      });
    }
  }

  Supply.init({
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
    vendor_product_tag_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'vendor_product_tags',
        key: 'id'
      }
    },
    combination_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'variant_combinations',
        key: 'id'
      }
    },
    quantity_supplied: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    supply_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'Supply',
    tableName: 'supply',
    timestamps: false,
    underscored: true
  });

  return Supply;
};