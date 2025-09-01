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
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
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