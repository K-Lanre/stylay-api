// models/product_variant.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductVariant extends Model {
    static associate(models) {
      ProductVariant.belongsTo(models.Product, {
        foreignKey: 'product_id'
      });
    }
  }

  ProductVariant.init({
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    value: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    additional_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'ProductVariant',
    tableName: 'product_variants',
    timestamps: false,
    underscored: true
  });

  return ProductVariant;
};