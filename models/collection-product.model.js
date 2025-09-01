// models/collection_product.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CollectionProduct extends Model {
    static associate(models) {
      CollectionProduct.belongsTo(models.Collection, {
        foreignKey: 'collection_id'
      });
      CollectionProduct.belongsTo(models.Product, {
        foreignKey: 'product_id'
      });
    }
  }

  CollectionProduct.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    collection_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    modelName: 'CollectionProduct',
    tableName: 'collection_products',
    timestamps: false,
    underscored: true
  });

  return CollectionProduct;
};