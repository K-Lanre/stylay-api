// models/variant_type.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VariantType extends Model {
    static associate(models) {
      // VariantType has many ProductVariants
      VariantType.hasMany(models.ProductVariant, {
        foreignKey: 'variant_type_id',
        as: 'variants'
      });
    }
  }

  VariantType.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Internal identifier for variant type (e.g., "color", "size")'
    },
    display_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'User-friendly display name (e.g., "Color", "Size")'
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Display order for variant types'
    }
  }, {
    sequelize,
    modelName: 'VariantType',
    tableName: 'variant_types',
    timestamps: true,
    underscored: true
  });

  return VariantType;
};
