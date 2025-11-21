// models/cart.js
'use strict';
const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Cart extends Model {
    static associate(models) {
      // Define associations
      Cart.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
      
      Cart.hasMany(models.CartItem, {
        foreignKey: 'cart_id',
        as: 'items'
      });
    }

    // Instance method to calculate cart totals
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
        
        // Calculate item total including variants
        const basePrice = parseFloat(item.price) || 0;
        
        // Handle selected_variants which might be stored as JSON string
        let variants = item.selected_variants;
        if (typeof variants === 'string') {
          try {
            variants = JSON.parse(variants);
          } catch (e) {
            variants = [];
          }
        }
        
        const variantPrice = Array.isArray(variants) ? variants.reduce(
          (sum, v) => sum + (parseFloat(v.additional_price) || 0),
          0
        ) : 0;
        
        const itemTotal = (basePrice + variantPrice) * item.quantity;
        totalAmount += parseFloat(itemTotal.toFixed(2));

        // Update item's total price if it doesn't match
        if (Math.abs(parseFloat(item.total_price) - itemTotal) > 0.01) {
          await item.update({ total_price: itemTotal.toFixed(2) }, { transaction });
        }
      }

      return {
        totalItems,
        totalAmount: parseFloat(totalAmount.toFixed(2))
      };
    }

    // Instance method to update cart totals
    async updateTotals(transaction = null) {
      const totals = await this.calculateTotals(transaction);
      await this.update({
        total_items: totals.totalItems,
        total_amount: totals.totalAmount
      }, { transaction });
    }

    // Instance method to get cart with full product and variant details
    async getFullCart() {
      const cart = await Cart.findByPk(this.id, {
        include: [
          {
            model: sequelize.models.CartItem,
            as: 'items',
            include: [
              {
                model: sequelize.models.Product,
                as: 'product',
                attributes: [
                  'id', 'name', 'slug', 'thumbnail',
                  'price', 'discounted_price', 'status'
                ],
                include: [
                  {
                    model: sequelize.models.ProductImage,
                    as: 'images',
                    attributes: ['id', 'image_url', 'is_featured'],
                    required: false,
                    limit: 1,
                    where: { is_featured: true }
                  }
                ]
              }
            ]
          }
        ]
      });

      if (!cart) return null;

      // Convert to plain object and process each item
      const plainCart = cart.get({ plain: true });
      
      // Process each item to include variant details
      for (const item of plainCart.items) {
        if (item.selected_variants && item.selected_variants.length > 0) {
          // If selected_variants is a string, parse it first
          let variants;
          if (typeof item.selected_variants === 'string') {
            try {
              variants = JSON.parse(item.selected_variants);
            } catch (e) {
              console.warn(`Failed to parse selected_variants for item ${item.id}: ${e.message}`);
              variants = [];
            }
          } else {
            variants = item.selected_variants;
          }
          
          if (!Array.isArray(variants)) {
            variants = [];
            item.selected_variants = [];
          }
          
          const variantIds = variants.map(v => v.id);
          
          if (variantIds.length > 0) {
            // Fetch only existing fields from ProductVariant (additional_price moved off this table)
            const dbVariants = await sequelize.models.ProductVariant.findAll({
              where: { id: variantIds },
              attributes: ['id', 'name', 'value'],
              raw: true
            });

            // Merge additional_price from the parsed selected_variants payload
            const additionalPriceMap = new Map(
              variants.map(v => [Number(v.id), parseFloat(v.additional_price) || 0])
            );

            item.selected_variants = dbVariants.map(v => ({
              ...v,
              additional_price: additionalPriceMap.get(Number(v.id)) || 0
            }));
          } else {
            item.selected_variants = [];
          }
        } else {
          item.selected_variants = [];
        }
      }

      return plainCart;
    }

    // Helper method to find a cart item by product and variants
    async findCartItem(productId, selectedVariantIds = []) {
      const items = await this.getItems();
      
      return items.find(item => {
        // Match product ID
        if (item.product_id !== productId) return false;
        
        // If no variants specified, match items with no variants
        if ((!selectedVariantIds || selectedVariantIds.length === 0) &&
            (!item.selected_variants || item.selected_variants.length === 0)) {
          return true;
        }
        
        // If variants specified, match exact variant combination
        if (item.selected_variants && item.selected_variants.length > 0) {
          // Handle both string and array formats for selected_variants
          let itemVariants;
          if (typeof item.selected_variants === 'string') {
            try {
              itemVariants = JSON.parse(item.selected_variants);
            } catch (e) {
              console.warn(`Failed to parse selected_variants for item ${item.id}: ${e.message}`);
              itemVariants = [];
            }
          } else {
            itemVariants = item.selected_variants;
          }
          
          if (!Array.isArray(itemVariants)) {
            itemVariants = [];
          }
            
          const itemVariantIds = itemVariants.map(v => v.id).sort();
          const searchVariantIds = [...selectedVariantIds].sort();
          
          return itemVariantIds.length === searchVariantIds.length &&
                 itemVariantIds.every((v, i) => v === searchVariantIds[i]);
        }
        
        return false;
      });
    }
  }

  Cart.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true, // Allow null for guest carts
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'For guest users without accounts'
    },
    total_items: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
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
    modelName: 'Cart',
    tableName: 'carts',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id'],
        where: {
          user_id: {
            [Op.ne]: null
          }
        }
      },
      {
        fields: ['session_id'],
        where: {
          session_id: {
            [Op.ne]: null
          }
        }
      }
    ]
  });

  return Cart;
};
