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
      allowNull: false
    },
    supply_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    restocked_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Timestamps are handled by Sequelize automatically
  }, {
    sequelize,
    modelName: 'Inventory',
    tableName: 'inventory',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: false,
        fields: ['product_id']
      },
      {
        unique: false,
        fields: ['supply_id']
      }
    ]
  });

  return Inventory;
};