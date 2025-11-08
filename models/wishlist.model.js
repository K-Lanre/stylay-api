// models/wishlist.js
'use strict';
const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Wishlist extends Model {
    static associate(models) {
      Wishlist.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
      Wishlist.hasMany(models.WishlistItem, {
        foreignKey: 'wishlist_id',
        as: 'items'
      });
    }

    // Instance method to calculate wishlist totals
    async calculateTotals(transaction = null) {
      const items = await this.getItems({
        include: [
          {
            model: sequelize.models.Product,
            as: 'product',
            attributes: ['price', 'discounted_price']
          }
        ],
        transaction
      });

      let totalItems = 0;
      let totalAmount = 0;

      // Process each item to calculate totals
      for (const item of items) {
        totalItems += item.quantity;
        totalAmount += parseFloat(item.total_price) || 0;
      }

      return {
        totalItems,
        totalAmount: parseFloat(totalAmount.toFixed(2))
      };
    }

    // Instance method to update wishlist totals
    async updateTotals(transaction = null) {
      const totals = await this.calculateTotals(transaction);
      await this.update({
        total_items: totals.totalItems,
        total_amount: totals.totalAmount
      }, { transaction });
    }

    // Instance method to get wishlist with items count
    async getItemCount() {
      const count = await this.countItems();
      return count;
    }

    // Instance method to get wishlist with full details
    async getFullDetails() {
      return await Wishlist.findByPk(this.id, {
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email']
          },
          {
            model: sequelize.models.WishlistItem,
            as: 'items',
            include: [
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
          }
        ]
      });
    }

    // Instance method to check if wishlist is owned by user
    isOwnedBy(userId) {
      return this.user_id === userId;
    }

    // Instance method to add item to wishlist
    async addItem(productId, selectedVariants = [], quantity = 1, notes = null, priority = 'medium', variantId = null) {
      let finalSelectedVariants = [...selectedVariants];
      let basePrice = 0;
      let finalVariantId = variantId;

      const product = await sequelize.models.Product.findByPk(productId);
      if (!product) throw new Error('Product not found');

      basePrice = product.price;

      if (finalSelectedVariants.length > 0) {
        // Validate and calculate additional price
        const variantMap = new Map();
        const productVariants = await product.getVariants();
        productVariants.forEach(v => variantMap.set(Number(v.id), v));

        for (const sel of finalSelectedVariants) {
          const variantId = Number(sel.id);
          if (isNaN(variantId)) {
            throw new Error("Invalid variant ID: must be a number");
          }

          const variant = variantMap.get(variantId);
          if (!variant) {
            throw new Error(`Variant ${variantId} not found for product`);
          }
        }
        finalVariantId = null; // Clear for multiple variants
      } else if (variantId) {
        // Backward compatibility: single variant
        const variant = await sequelize.models.ProductVariant.findByPk(variantId);
        if (!variant || variant.product_id !== productId) {
          throw new Error("Product variant not found");
        }
        finalSelectedVariants = [{
          name: variant.name,
          id: variant.id,
          value: variant.value,
          additional_price: variant.additional_price || 0
        }];
        finalVariantId = variantId;
      }

      const totalPrice = basePrice + finalSelectedVariants.reduce((sum, v) => sum + (v.additional_price || 0), 0);

      // Sort variants for consistent comparison
      const sortedSelectedVariants = [...finalSelectedVariants].sort((a, b) => a.id - b.id);

      const [item, created] = await sequelize.models.WishlistItem.findOrCreate({
        where: {
          wishlist_id: this.id,
          product_id: productId,
          selected_variants: sortedSelectedVariants.length > 0 ? sortedSelectedVariants : null
        },
        defaults: {
          quantity,
          notes,
          priority,
          price: basePrice,
          total_price: totalPrice * quantity,
          selected_variants: sortedSelectedVariants.length > 0 ? sortedSelectedVariants : null,
          variant_id: finalVariantId
        }
      });

      if (!created) {
        // Update existing item
        await item.update({
          quantity,
          notes,
          priority,
          price: basePrice,
          total_price: totalPrice * quantity,
          selected_variants: sortedSelectedVariants.length > 0 ? sortedSelectedVariants : null,
          variant_id: finalVariantId
        });
      }

      return item;
    }

    // Helper method to get current price
    async getCurrentPrice(productId, variantId = null, selectedVariants = []) {
      const product = await sequelize.models.Product.findByPk(productId);
      if (!product) return 0;

      let currentPrice = product.price;

      if (selectedVariants.length > 0) {
        // Use new selected_variants format
        const variantPrice = selectedVariants.reduce(
          (sum, variant) => sum + (parseFloat(variant.additional_price) || 0),
          0
        );
        currentPrice += variantPrice;
      } else if (variantId) {
        // Backward compatibility: use single variant_id
        const variant = await sequelize.models.ProductVariant.findByPk(variantId);
        if (variant && variant.additional_price) {
          currentPrice += variant.additional_price;
        }
      }

      return currentPrice;
    }

    // Instance method to remove item from wishlist
    async removeItem(productId, selectedVariants = [], variantId = null) {
      let whereClause = {
        wishlist_id: this.id,
        product_id: productId
      };

      if (selectedVariants.length > 0) {
        const sortedSelectedVariants = [...selectedVariants].sort((a, b) => a.id - b.id);
        whereClause.selected_variants = sortedSelectedVariants;
      } else if (variantId) {
        whereClause.variant_id = variantId;
      } else {
        whereClause.selected_variants = null;
      }

      const item = await sequelize.models.WishlistItem.findOne({
        where: whereClause
      });

      if (item) {
        await item.destroy();
        return true;
      }
      return false;
    }

    // Instance method to share wishlist
    async makePublic() {
      await this.update({ is_public: true });
      return this;
    }

    // Instance method to make wishlist private
    async makePrivate() {
      await this.update({ is_public: false });
      return this;
    }
  }

  Wishlist.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    total_items: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Total number of items in wishlist'
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      },
      comment: 'Total amount of all items in wishlist'
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
    modelName: 'Wishlist',
    tableName: 'wishlists',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'is_default'],
        where: {
          is_default: true
        }
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['is_public']
      }
    ]
  });

  // Hook to ensure only one default wishlist per user
  Wishlist.addHook('beforeSave', async (wishlist) => {
    if (wishlist.is_default) {
      // Set all other wishlists for this user to non-default
      await Wishlist.update(
        { is_default: false },
        {
          where: {
            user_id: wishlist.user_id,
            id: { [Op.ne]: wishlist.id }
          }
        }
      );
    }
  });

  return Wishlist;
};