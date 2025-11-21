// models/product_variant.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductVariant extends Model {
    static associate(models) {
      ProductVariant.belongsTo(models.Product, {
        foreignKey: 'product_id'
      });

      // ProductVariant belongs to VariantType
      ProductVariant.belongsTo(models.VariantType, {
        foreignKey: 'variant_type_id',
        as: 'variantType'
      });

      // ProductVariant has many-to-many relationship with VariantCombination
      ProductVariant.belongsToMany(models.VariantCombination, {
        through: models.VariantCombinationVariant,
        foreignKey: 'variant_id',
        otherKey: 'combination_id',
        as: 'combinations'
      });
    }
  }

  ProductVariant.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    variant_type_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true, // Allow null for backward compatibility
      comment: 'Reference to variant type (Color, Size, etc.)'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    value: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'ProductVariant',
    tableName: 'product_variants',
    timestamps: false,
    underscored: true
  });

  return ProductVariant;
};
