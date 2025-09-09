// models/payout.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payout extends Model {
    static associate(models) {
      Payout.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id'
      });
    }
  }

  Payout.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    vendor_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    payout_date: {
      type: DataTypes.DATE,
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
    modelName: 'Payout',
    tableName: 'payouts',
    timestamps: false,
    underscored: true
  });

  return Payout;
};