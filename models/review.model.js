// models/review.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    static associate(models) {
      Review.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: "product"
      });
      Review.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: "user"
      });
    }
  }

  Review.init({
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
    user_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    rating: {
      type: DataTypes.TINYINT({ unsigned: true }),
      allowNull: false
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'Review',
    tableName: 'reviews',
    timestamps: false,
    underscored: true
  });

  return Review;
};