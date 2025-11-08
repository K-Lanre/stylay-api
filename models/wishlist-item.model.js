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

    // Instance method to calculate total price including variant prices
    calculateTotalPrice() {
      const basePrice = parseFloat(this.price) || 0;
      const variantPrice = this.calculateVariantPrice();
      const totalPrice = (basePrice + variantPrice) * this.quantity;
      return parseFloat(totalPrice.toFixed(2));
    }

    // Calculate total additional price from all selected variants
    calculateVariantPrice() {
      if (!this.selected_variants || this.selected_variants.length === 0) {
        return 0;
      }
      
      // If selected_variants is a string, parse it first
      const variants = typeof this.selected_variants === 'string'
        ? JSON.parse(this.selected_variants)
        : this.selected_variants;
      
      if (!Array.isArray(variants)) {
        return 0;
      }
      
      return variants.reduce(
        (sum, variant) => sum + (parseFloat(variant.additional_price) || 0),
        0
      );
    }

    // Instance method to update total price
    async updateTotalPrice(transaction = null) {
      const totalPrice = this.calculateTotalPrice();
      await this.update({ total_price: totalPrice }, { transaction });
      return totalPrice;
    }

    // Get all variant details for display
    async getVariantDetails() {
      if (!this.selected_variants || this.selected_variants.length === 0) {
        return [];
      }
      
      // If selected_variants is a string, parse it first
      let variants;
      if (typeof this.selected_variants === 'string') {
        try {
          variants = JSON.parse(this.selected_variants);
        } catch (e) {
          console.warn(`Failed to parse selected_variants for wishlist item ${this.id}: ${e.message}`);
          return [];
        }
      } else {
        variants = this.selected_variants;
      }
      
      if (!Array.isArray(variants)) {
        return [];
      }
      
      const variantIds = variants.map(v => v.id);
      
      return await sequelize.models.ProductVariant.findAll({
        where: { id: variantIds },
        attributes: ['id', 'name', 'value', 'additional_price'],
        raw: true
      });
    }

    // Instance method to get full item details
    async getFullDetails() {
      const item = await WishlistItem.findByPk(this.id, {
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

      // Add selected variants to the response
      if (item) {
        const plainItem = item.get({ plain: true });
        if (this.selected_variants && this.selected_variants.length > 0) {
          plainItem.selected_variants = await this.getVariantDetails();
        } else {
          plainItem.selected_variants = [];
        }
        return plainItem;
      }
      return null;
    }

    // Instance method to check if product is available
    async checkAvailability() {
      const product = await this.getProduct();
      if (!product || product.status !== 'active') {
        return { available: false, reason: 'Product is no longer available' };
      }

      // Check stock for each selected variant
      if (this.selected_variants && this.selected_variants.length > 0) {
        const variants = await this.getVariantDetails();

        // Check if all variants exist
        for (const variant of variants) {
          if (!variant) {
            return {
              available: false,
              reason: `Variant not found`
            };
          }
        }
      } else if (this.variant_id) {
        // Backward compatibility: check single variant
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

      if (this.selected_variants && this.selected_variants.length > 0) {
        // Use new selected_variants format
        const variants = this.selected_variants;
        const variantPrice = variants.reduce(
          (sum, variant) => sum + (parseFloat(variant.additional_price) || 0),
          0
        );
        currentPrice += variantPrice;
      } else if (this.variant_id) {
        // Backward compatibility: use single variant_id
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
          selected_variants: this.selected_variants || null
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

    // Helper method to convert legacy variant_id to selected_variants
    async convertFromLegacyVariant() {
      if (this.variant_id && (!this.selected_variants || this.selected_variants.length === 0)) {
        const variant = await this.getVariant();
        if (variant) {
          this.selected_variants = [{
            id: variant.id,
            name: variant.name,
            value: variant.value,
            additional_price: variant.additional_price || 0
          }];
          await this.save();
        }
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
      onDelete: 'SET NULL',
      comment: 'Legacy field for backward compatibility - use selected_variants instead'
    },
    selected_variants: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of selected variant objects with id, name, value, and additional_price (like cart system)'
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
      comment: 'Base price at the time item was added to wishlist'
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      },
      comment: 'Total price including base price and variant additional prices'
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
    ],
    hooks: {
      beforeSave: async (item) => {
        // Ensure prices are properly formatted
        if (item.changed('price') && item.price !== undefined) {
          item.price = parseFloat(Number(item.price).toFixed(2));
        }
        if (item.changed('total_price') && item.total_price !== undefined) {
          item.total_price = parseFloat(Number(item.total_price).toFixed(2));
        }
        
        // Ensure quantity is an integer
        if (item.changed('quantity') && item.quantity !== undefined) {
          item.quantity = Math.max(1, parseInt(item.quantity) || 1);
        }

        // If selected_variants is provided and variant_id exists, sync them
        if (item.changed('selected_variants') && item.selected_variants && item.variant_id) {
          // If first variant in array matches variant_id, keep the variant_id for backward compatibility
          if (Array.isArray(item.selected_variants) && item.selected_variants.length > 0) {
            const firstVariant = item.selected_variants[0];
            if (firstVariant.id === item.variant_id) {
              // Keep variant_id for backward compatibility
            } else {
              // Clear variant_id if it doesn't match selected_variants
              item.variant_id = null;
            }
          }
        }
      },
      afterSave: async (item, options) => {
        const transaction = options?.transaction;
        // Update the wishlist totals when an item is saved
        if (item.wishlist) {
          await item.wishlist.updateTotals(transaction);
        } else if (item.wishlist_id) {
          const wishlist = await item.getWishlist({ transaction });
          if (wishlist) {
            await wishlist.updateTotals(transaction);
          }
        }
      },
      afterDestroy: async (item, options) => {
        const transaction = options?.transaction;
        // Update the wishlist totals when an item is removed
        if (item.wishlist) {
          await item.wishlist.updateTotals(transaction);
        } else if (item.wishlist_id) {
          const wishlist = await item.getWishlist({ transaction });
          if (wishlist) {
            await wishlist.updateTotals(transaction);
          }
        }
      }
    }
  });

  return WishlistItem;
};