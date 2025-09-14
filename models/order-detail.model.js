// models/order_detail.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderDetail extends Model {
    static associate(models) {
      OrderDetail.belongsTo(models.Order, {
        foreignKey: 'order_id',
        as: 'order'
      });
      OrderDetail.belongsTo(models.Address, {
        foreignKey: 'address_id',
        as: 'address'
      });
    }
  }

  OrderDetail.init({
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
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    address_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'addresses',
        key: 'id'
      },
      onDelete: 'NO ACTION'
    },
    shipping_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    tax_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
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
    modelName: 'OrderDetail',
    tableName: 'order_details',
    timestamps: false,
    underscored: true
  });

  return OrderDetail;
};