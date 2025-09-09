// models/collection.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Collection extends Model {
    static associate(models) {
      Collection.hasMany(models.CollectionProduct, {
        foreignKey: 'collection_id'
      });
      Collection.belongsToMany(models.Product, {
        through: models.CollectionProduct,
        foreignKey: 'collection_id',
        otherKey: 'product_id'
      });
    }
  }

  Collection.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
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
    modelName: 'Collection',
    tableName: 'collections',
    timestamps: false,
    underscored: true
  });

  return Collection;
};