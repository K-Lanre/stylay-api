// models/order_item.js
'use strict';
const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      OrderItem.belongsTo(models.Order, {
        foreignKey: 'order_id',
        as: 'order'
      });
      OrderItem.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
      });
      OrderItem.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id',
        as: 'vendor'
      });
      OrderItem.belongsTo(models.ProductVariant, {
        foreignKey: 'variant_id',
        as: 'variant'
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

    // Get all variant details for display
    async getVariantDetails() {
      if (!this.selected_variants || this.selected_variants.length === 0) {
        // Fallback to variant_id if selected_variants is not available
        if (this.variant_id) {
          return await sequelize.models.ProductVariant.findAll({
            where: { id: this.variant_id },
            attributes: ['id', 'name', 'value', 'additional_price'],
            raw: true
          });
        }
        return [];
      }

      // If selected_variants is a string, parse it first
      let variants;
      if (typeof this.selected_variants === 'string') {
        try {
          variants = JSON.parse(this.selected_variants);
        } catch (e) {
          console.warn(`Failed to parse selected_variants for order item ${this.id}: ${e.message}`);
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
      } else if (this.variant_id) {
        // Check if the single variant exists
        const variant = await this.getVariant();
        if (!variant) {
          return {
            available: false,
            reason: `Variant not found`
          };
        }
      }

      return { available: true };
    }

    // Getter for backward compatibility - returns the first variant if multiple are selected
    get variant() {
      if (this.selected_variants && this.selected_variants.length > 0) {
        const variants = typeof this.selected_variants === 'string'
          ? JSON.parse(this.selected_variants)
          : this.selected_variants;
        return variants[0] || null;
      }
      // Fallback to Sequelize's association getter
      return this.getVariant ? this.getVariant() : null;
    }

    // Setter for backward compatibility
    set variant(variant) {
      if (variant) {
        this.selected_variants = [variant];
      } else {
        this.selected_variants = null;
      }
    }
  }

  OrderItem.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    vendor_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true, // Changed to allow null, as product.vendor_id can be null
      references: {
        model: 'vendors',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    variant_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true,
      references: {
        model: 'product_variants',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    quantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    sub_total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    selected_variants: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of selected variant objects with id, name, value, and additional_price'
    },
    // Timestamps are now handled automatically by Sequelize
  }, {
    sequelize,
    modelName: 'OrderItem',
    tableName: 'order_items',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return OrderItem;
};