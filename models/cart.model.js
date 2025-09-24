// models/cart.js
'use strict';
const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Cart extends Model {
    static associate(models) {
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
    async calculateTotals() {
      const items = await this.getItems({
        include: [
          {
            model: sequelize.models.Product,
            as: 'product',
            attributes: ['price', 'discounted_price']
          },
          {
            model: sequelize.models.ProductVariant,
            as: 'variant',
            attributes: ['additional_price']
          }
        ]
      });

      let totalItems = 0;
      let totalAmount = 0;

      items.forEach(item => {
        totalItems += item.quantity;
        totalAmount += parseFloat(item.total_price);
      });

      return {
        totalItems,
        totalAmount: parseFloat(totalAmount.toFixed(2))
      };
    }

    // Instance method to update cart totals
    async updateTotals() {
      const totals = await this.calculateTotals();
      await this.update({
        total_items: totals.totalItems,
        total_amount: totals.totalAmount
      });
    }

    // Instance method to get cart with full product details
    async getFullCart() {
      return await Cart.findByPk(this.id, {
        include: [
          {
            model: sequelize.models.CartItem,
            as: 'items',
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
          }
        ]
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
    ]
  });

  return Cart;
};