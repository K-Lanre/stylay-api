// models/order_info.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderInfo extends Model {
    static associate(models) {
      OrderInfo.belongsTo(models.Order, {
        foreignKey: 'order_id'
      });
    }
  }

  OrderInfo.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      unique: true
    },
    info: {
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
    modelName: 'OrderInfo',
    tableName: 'order_info',
    timestamps: false,
    underscored: true
  });

  return OrderInfo;
};