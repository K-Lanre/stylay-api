// models/wishlist-item.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WishlistItem extends Model {
    static associate(models) {
      WishlistItem.belongsTo(models.Wishlist, {
        foreignKey: 'wishlist_id',
        as: 'wishlist'
      });
      WishlistItem.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
      });
    }
  }

  WishlistItem.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    wishlist_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'wishlists',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    price_at_addition: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Price at the time item was added to wishlist'
    },
    added_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'WishlistItem',
    tableName: 'wishlist_items',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['wishlist_id', 'product_id'],
        name: 'unique_wishlist_product'
      },
      {
        fields: ['wishlist_id']
      },
      {
        fields: ['product_id']
      },
      {
        fields: ['added_at']
      }
    ]
  });

  return WishlistItem;
};
