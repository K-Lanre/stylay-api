// models/variant_combination_variant.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VariantCombinationVariant extends Model {
    static associate(models) {
      // This is a junction table, so associations are defined in the related models
    }
  }

  VariantCombinationVariant.init({
    combination_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      comment: 'Reference to variant combination'
    },
    variant_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      comment: 'Reference to product variant'
    }
  }, {
    sequelize,
    modelName: 'VariantCombinationVariant',
    tableName: 'variant_combination_variants',
    timestamps: false, // Junction table doesn't need timestamps
    underscored: true
  });

  return VariantCombinationVariant;
};
