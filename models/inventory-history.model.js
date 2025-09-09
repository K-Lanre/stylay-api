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
    adjustment: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Positive for stock in, negative for stock out'
    },
    previous_stock: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    new_stock: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    adjusted_by: {
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
    modelName: 'InventoryHistory',
    tableName: 'inventory_history',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['inventory_id']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return InventoryHistory;
};
