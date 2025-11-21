'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InventoryHistory extends Model {
    static associate(models) {
      InventoryHistory.belongsTo(models.Inventory, {
        foreignKey: 'inventory_id'
      });
      InventoryHistory.belongsTo(models.User, {
        foreignKey: 'adjusted_by',
        as: 'adjustedBy'
      });
      InventoryHistory.belongsTo(models.VariantCombination, {
        foreignKey: 'combination_id',
        as: 'combination'
      });
    }
  }

  InventoryHistory.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    inventory_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    combination_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true, // Allow null for historical records not tied to a combination, or if product has no variants
      comment: 'Reference to the variant combination whose stock was adjusted'
    },
    change_amount: { // Renamed from 'adjustment' for clarity
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Positive for stock in, negative for stock out'
    },
    change_type: {
      type: DataTypes.ENUM('supply', 'sale', 'return', 'manual_adjustment', 'other'),
      allowNull: false,
      defaultValue: 'manual_adjustment'
    },
    previous_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Stock level of the combination BEFORE the adjustment'
    },
    new_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Stock level of the combination AFTER the adjustment'
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional notes for the adjustment'
    },
    adjusted_by: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      comment: 'ID of the user who made the adjustment'
    },
    // Timestamps are now handled automatically by Sequelize
  }, {
    sequelize,
    modelName: 'InventoryHistory',
    tableName: 'inventory_history',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['inventory_id']
      },
      {
        fields: ['combination_id']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return InventoryHistory;
};
