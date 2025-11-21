// models/inventory.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Inventory extends Model {
    static associate(models) {
      Inventory.belongsTo(models.Product, {
        foreignKey: 'product_id'
      });
      Inventory.belongsTo(models.Supply, {
        foreignKey: 'supply_id'
      });
    }
  }

  Inventory.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      unique: true // Product can only have one inventory record
    },
    supply_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true,
      comment: 'Last supply event that affected this inventory record'
    },
    restocked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date of the last restock activity'
    },
    // The actual stock quantity is now managed by VariantCombination.stock
  }, {
    sequelize,
    modelName: 'Inventory',
    tableName: 'inventory',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: false,
        fields: ['supply_id']
      }
    ]
  });

  return Inventory;
};
