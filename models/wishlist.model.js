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
    async addItem(productId, variantId = null, quantity = 1, notes = null, priority = 'medium') {
      const [item, created] = await sequelize.models.WishlistItem.findOrCreate({
        where: {
          wishlist_id: this.id,
          product_id: productId,
          variant_id: variantId
        },
        defaults: {
          quantity,
          notes,
          priority,
          price: await this.getCurrentPrice(productId, variantId)
        }
      });

      if (!created) {
        // Update existing item
        await item.update({
          quantity,
          notes,
          priority,
          price: await this.getCurrentPrice(productId, variantId)
        });
      }

      return item;
    }

    // Helper method to get current price
    async getCurrentPrice(productId, variantId = null) {
      const product = await sequelize.models.Product.findByPk(productId);
      if (!product) return 0;

      if (variantId) {
        const variant = await sequelize.models.ProductVariant.findByPk(variantId);
        if (variant && variant.additional_price) {
          return product.price + variant.additional_price;
        }
      }

      return product.price;
    }

    // Instance method to remove item from wishlist
    async removeItem(productId, variantId = null) {
      const item = await sequelize.models.WishlistItem.findOne({
        where: {
          wishlist_id: this.id,
          product_id: productId,
          variant_id: variantId
        }
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