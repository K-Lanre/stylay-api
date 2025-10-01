// models/cart-item.js
'use strict';
const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CartItem extends Model {
    static associate(models) {
      // Define associations
      CartItem.belongsTo(models.Cart, {
        foreignKey: 'cart_id',
        as: 'cart'
      });
      
      CartItem.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
      });
    }

    // Instance method to calculate total price for this item including variant prices
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
          console.warn(`Failed to parse selected_variants for cart item ${this.id}: ${e.message}`);
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

    // Instance method to get item details with product and variant info
    async getFullDetails() {
      const item = await CartItem.findByPk(this.id, {
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

    // Instance method to check if product is still available with all selected variants
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
      } else {
        return { available: true };
      }

      return { available: true };
    }
  }

  CartItem.init({
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    cart_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'carts',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    product_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    quantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    selected_variants: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of selected variant objects with id, name, value, and additional_price'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'CartItem',
    tableName: 'cart_items',
    timestamps: true,
    underscored: true,
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
      },
      afterSave: async (item, options) => {
        const transaction = options?.transaction;
        // Update the cart totals when an item is saved
        if (item.cart) {
          await item.cart.updateTotals(transaction);
        } else if (item.cart_id) {
          const cart = await item.getCart({ transaction });
          if (cart) {
            await cart.updateTotals(transaction);
          }
        }
      },
      afterDestroy: async (item, options) => {
        const transaction = options?.transaction;
        // Update the cart totals when an item is removed
        if (item.cart) {
          await item.cart.updateTotals(transaction);
        } else if (item.cart_id) {
          const cart = await item.getCart({ transaction });
          if (cart) {
            await cart.updateTotals(transaction);
          }
        }
      }
    }
  });

  return CartItem;
};
