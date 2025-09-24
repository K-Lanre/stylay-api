// models/wishlist-item.js
'use strict';
const { Model, Op } = require('sequelize');

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
      WishlistItem.belongsTo(models.ProductVariant, {
        foreignKey: 'variant_id',
        as: 'variant'
      });
    }

    // Instance method to calculate current total price
    calculateTotalPrice() {
      return parseFloat((this.quantity * this.price).toFixed(2));
    }

    // Instance method to get full item details
    async getFullDetails() {
      return await WishlistItem.findByPk(this.id, {
        include: [
          {
            model: sequelize.models.Wishlist,
            as: 'wishlist',
            include: [
              {
                model: sequelize.models.User,
                as: 'user',
                attributes: ['id', 'first_name', 'last_name', 'email']
              }
            ]
          },
          {
            model: sequelize.models.Product,
            as: 'product',
            attributes: ['id', 'name', 'slug', 'price', 'discounted_price', 'thumbnail', 'status'],
            include: [
              {
                model: sequelize.models.ProductImage,
                as: 'images',
                attributes: ['id', 'image_url', 'is_featured'],
                required: false,
                limit: 1,
                where: { is_featured: true }
              },
              {
                model: sequelize.models.Vendor,
                as: 'vendor',
                attributes: ['id'],
                include: [
                  {
                    model: sequelize.models.Store,
                    as: 'store',
                    attributes: ['id', 'business_name', 'logo']
                  }
                ]
              }
            ]
          },
          {
            model: sequelize.models.ProductVariant,
            as: 'variant',
            attributes: ['id', 'name', 'value', 'additional_price'],
            required: false
          }
        ]
      });
    }

    // Instance method to check if product is available
    async checkAvailability() {
      const product = await this.getProduct();
      if (!product || product.status !== 'active') {
        return { available: false, reason: 'Product is no longer available' };
      }

      if (this.variant_id) {
        const variant = await this.getVariant();
        if (!variant) {
          return { available: false, reason: 'Product variant no longer exists' };
        }
      }

      return { available: true };
    }

    // Instance method to update price
    async updatePrice() {
      const currentPrice = await this.getCurrentPrice();
      if (Math.abs(currentPrice - this.price) > 0.01) {
        await this.update({ price: currentPrice });
        return currentPrice;
      }
      return this.price;
    }

    // Helper method to get current price
    async getCurrentPrice() {
      const product = await this.getProduct();
      if (!product) return this.price;

      let currentPrice = product.price;

      if (this.variant_id) {
        const variant = await this.getVariant();
        if (variant && variant.additional_price) {
          currentPrice += variant.additional_price;
        }
      }

      return currentPrice;
    }

    // Instance method to move item to another wishlist
    async moveToWishlist(newWishlistId) {
      const newWishlist = await sequelize.models.Wishlist.findByPk(newWishlistId);
      if (!newWishlist) {
        throw new Error('Target wishlist not found');
      }

      // Check if item already exists in target wishlist
      const existingItem = await sequelize.models.WishlistItem.findOne({
        where: {
          wishlist_id: newWishlistId,
          product_id: this.product_id,
          variant_id: this.variant_id
        }
      });

      if (existingItem) {
        // Remove from current wishlist
        await this.destroy();
        return existingItem;
      } else {
        // Move to new wishlist
        await this.update({ wishlist_id: newWishlistId });
        return this;
      }
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
    variant_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true,
      references: {
        model: 'product_variants',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    quantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 999
      }
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Price at the time item was added to wishlist'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional notes about why this item was added'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'medium',
      comment: 'Priority level for this wishlist item'
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
        fields: ['wishlist_id', 'product_id', 'variant_id'],
        where: {
          variant_id: {
            [Op.ne]: null
          }
        }
      },
      {
        fields: ['wishlist_id']
      },
      {
        fields: ['product_id']
      },
      {
        fields: ['variant_id']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['added_at']
      }
    ]
  });

  return WishlistItem;
};