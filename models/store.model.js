// models/store.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Store extends Model {
    static associate(models) {
      Store.hasOne(models.Vendor, {
        foreignKey: 'store_id'
      });
    }
  }

  Store.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    business_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    cac_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    instagram_handle: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    facebook_handle: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    twitter_handle: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    business_images: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('business_images');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('business_images', JSON.stringify(value));
      }
    },
    bank_account_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    bank_account_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    logo: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('logo');
        return rawValue || null;
      },
      set(value) {
        this.setDataValue('logo', value || null);
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: 0
    },
    status: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
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
    modelName: 'Store',
    tableName: 'stores',
    timestamps: true,
    underscored: true
  });

  return Store;
};