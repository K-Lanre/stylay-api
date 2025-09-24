// models/cart-item.js
'use strict';
const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CartItem extends Model {
    static associate(models) {
      CartItem.belongsTo(models.Cart, {
        foreignKey: 'cart_id',
        as: 'cart'
      });
      CartItem.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
      });
      CartItem.belongsTo(models.ProductVariant, {
        foreignKey: 'variant_id',
        as: 'variant'
      });
    }

    // Instance method to calculate total price for this item
    calculateTotalPrice() {
      return parseFloat((this.quantity * this.price).toFixed(2));
    }

    // Instance method to update total price
    async updateTotalPrice() {
      const totalPrice = this.calculateTotalPrice();
      await this.update({ total_price: totalPrice });
      return totalPrice;
    }

    // Instance method to get item details with product info
    async getFullDetails() {
      return await CartItem.findByPk(this.id, {
        include: [
          {
            model: sequelize.models.Product,
            as: 'product',
            attributes: ['id', 'name', 'slug', 'thumbnail', 'price', 'discounted_price', 'status'],
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

    // Instance method to check if product is still available
    async checkAvailability() {
      const product = await this.getProduct();
      if (!product || product.status !== 'active') {
        return { available: false, reason: 'Product is no longer available' };
      }

      if (this.variant_id) {
        const variant = await this.getVariant();
        if (!variant || variant.stock < this.quantity) {
          return { available: false, reason: 'Product variant is out of stock' };
        }
      } else if (product.stock < this.quantity) {
        return { available: false, reason: 'Product is out of stock' };
      }

      return { available: true };
    }
  }

  CartItem.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    cart_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      references: {
        model: 'carts',
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
      comment: 'Price at the time item was added to cart'
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'quantity * price'
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
    modelName: 'CartItem',
    tableName: 'cart_items',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['cart_id']
      },
      {
        fields: ['product_id']
      },
      {
        fields: ['variant_id']
      },
      {
        unique: true,
        fields: ['cart_id', 'product_id', 'variant_id'],
        where: {
          variant_id: {
            [Op.ne]: null
          }
        }
      }
    ]
  });

  // Hook to update total_price when quantity or price changes
  CartItem.addHook('beforeSave', async (cartItem) => {
    if (cartItem.changed('quantity') || cartItem.changed('price')) {
      cartItem.total_price = cartItem.calculateTotalPrice();
    }
  });

  return CartItem;
};