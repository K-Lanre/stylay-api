// models/order.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.User, {
        foreignKey: 'user_id'
      });
      Order.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id'
      });
      Order.belongsTo(models.Address, {
        foreignKey: 'address_id'
      });
      Order.hasMany(models.OrderItem, {
        foreignKey: 'order_id',
        as: 'items'
      });
      Order.hasMany(models.PaymentTransaction, {
        foreignKey: 'order_id',
        as: 'transactions'
      });
    }
  }

  Order.init({
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
    vendor_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true
    },
    address_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    shipping: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    payment_method: {
      type: DataTypes.STRING,
      allowNull: true
    },
    order_status: {
      type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    shipping_details: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    timestamps: false,
    underscored: true
  });

  return Order;
};