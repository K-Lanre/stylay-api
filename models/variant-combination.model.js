// models/variant_combination.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VariantCombination extends Model {
    static associate(models) {
      // VariantCombination belongs to Product
      VariantCombination.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
      });

      // VariantCombination has many-to-many relationship with ProductVariant
      VariantCombination.belongsToMany(models.ProductVariant, {
        through: models.VariantCombinationVariant,
        foreignKey: 'combination_id',
        otherKey: 'variant_id',
        as: 'variants'
      });
    }

    // Instance method to calculate total price for this combination
    calculateTotalPrice() {
      const product = this.product;
      if (!product) return 0;

      const basePrice = parseFloat(product.price) || 0;
      const modifier = parseFloat(this.price_modifier) || 0;
      return parseFloat((basePrice + modifier).toFixed(2));
    }

    // Instance method to check if combination is available
    async checkAvailability() {
      return this.is_active && this.stock > 0;
    }

    // Instance method to get formatted combination details
    async getFormattedDetails() {
      const combination = await VariantCombination.findByPk(this.id, {
        include: [
          {
            model: sequelize.models.Product,
            as: 'product',
            attributes: ['id', 'name', 'price', 'sku']
          },
          {
            model: sequelize.models.ProductVariant,
            as: 'variants',
            attributes: ['id', 'name', 'value', 'additional_price'],
            through: { attributes: [] } // Exclude junction table attributes
          }
        ]
      });

      if (!combination) return null;

      return {
        id: combination.id,
        combination_name: combination.combination_name,
        sku_suffix: combination.sku_suffix,
        stock: combination.stock,
        price_modifier: combination.price_modifier,
        total_price: combination.calculateTotalPrice(),
        is_active: combination.is_active,
        product: combination.product,
        variants: combination.variants
      };
    }
  }

  VariantCombination.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      comment: 'Product this combination belongs to'
    },
    combination_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Human-readable combination name (e.g., "Black-Large", "Blue-Medium")'
    },
    sku_suffix: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'SKU suffix for this combination (e.g., "BL", "BM")'
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Available stock for this specific combination'
    },
    price_modifier: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Price adjustment for this combination (can be negative)'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this combination is available for purchase'
    }
  }, {
    sequelize,
    modelName: 'VariantCombination',
    tableName: 'variant_combinations',
    timestamps: true,
    underscored: true
  });

  return VariantCombination;
};
