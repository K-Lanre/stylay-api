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
        foreignKey: 'order_id'
      });
      Order.hasMany(models.OrderDetail, {
        foreignKey: 'order_id'
      });
      Order.hasOne(models.OrderInfo, {
        foreignKey: 'order_id'
      });
      Order.hasMany(models.PaymentTransaction, {
        foreignKey: 'order_id'
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
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    order_status: {
      type: DataTypes.ENUM('processing', 'dispatched', 'delayed', 'success'),
      allowNull: false,
      defaultValue: 'processing'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
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