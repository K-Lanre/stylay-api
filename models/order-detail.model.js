// models/order_detail.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderDetail extends Model {
    static associate(models) {
      OrderDetail.belongsTo(models.Order, {
        foreignKey: 'order_id'
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
      allowNull: false
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true
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