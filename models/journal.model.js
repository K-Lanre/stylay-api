// models/journal.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Journal extends Model {
    static associate(models) {
      Journal.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
      });
    }
  }

  Journal.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Title is required'
        },
        len: {
          args: [5, 255],
          msg: 'Title must be between 5 and 255 characters'
        }
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Content is required'
        },
        min: {
          args: [10],
          msg: 'Content must be at least 10 characters'
        }
      }
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: true,
      references: {
        model: 'products',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Journal',
    tableName: 'journals',
    timestamps: true, // Let Sequelize handle the timestamps
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Journal;
};