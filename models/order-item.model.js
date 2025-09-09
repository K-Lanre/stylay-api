// models/order_item.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      OrderItem.belongsTo(models.Order, {
        foreignKey: 'order_id',
        as: 'order'
      });
      OrderItem.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
      });
    }
  }

  OrderItem.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'OrderItem',
    tableName: 'order_items',
    timestamps: false,
    underscored: true
  });

  return OrderItem;
};