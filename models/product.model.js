// models/product.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id',
        as: 'vendor', // Add alias to match the query
        allowNull: true // Explicitly allow null since the schema allows it
      });
      Product.belongsTo(models.Category, {
        foreignKey: 'category_id'
      });
      Product.hasMany(models.CollectionProduct, {
        foreignKey: 'product_id'
      });
      Product.belongsToMany(models.Collection, {
        through: models.CollectionProduct,
        foreignKey: 'product_id',
        otherKey: 'collection_id'
      });
      Product.hasOne(models.Inventory, {
        foreignKey: 'product_id'
      });
      Product.hasMany(models.OrderItem, {
        foreignKey: 'product_id'
      });
      Product.hasMany(models.ProductImage, {
        foreignKey: 'product_id',
        as: 'images'
      });
      Product.hasMany(models.ProductVariant, {
        foreignKey: 'product_id',
        as: 'variants'
      });
      Product.hasMany(models.VariantCombination, {
        foreignKey: 'product_id',
        as: 'combinations'
      });
      Product.hasMany(models.Review, {
        foreignKey: 'product_id',
        as: 'reviews'
      });
      Product.hasMany(models.Supply, {
        foreignKey: 'product_id'
      });
      Product.hasMany(models.VendorProductTag, {
        foreignKey: 'product_id'
      });
    }
  }

  Product.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'id' // Explicitly specify the field name
    },
    vendor_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true
    },
    category_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    thumbnail: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    discounted_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'apology'),
      allowNull: true,
      defaultValue: 'active'
    },
    impressions: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    sold_units: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
  }, {
    sequelize,
    modelName: 'Product',
    tableName: 'products',
    timestamps: true,
    underscored: true
  });

  return Product;
};
