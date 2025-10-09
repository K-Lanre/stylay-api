// models/order.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
      Order.hasMany(models.OrderItem, {
        foreignKey: 'order_id',
        as: 'items'
      });
      Order.hasOne(models.OrderDetail, {
        foreignKey: 'order_id',
        as: 'details'
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
    order_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
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
    payment_reference: {
      type: DataTypes.STRING,
      allowNull: true
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    order_status: {
      type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
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
    underscored: true
  });

  return Order;
};