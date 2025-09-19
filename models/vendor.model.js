// models/vendor.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Vendor extends Model {
    static associate(models) {
      Vendor.belongsTo(models.User, {
        foreignKey: "user_id",
      });
      Vendor.belongsTo(models.Store, {
        foreignKey: "store_id",
        as: "store" // Add alias to match the query
      });
      Vendor.belongsTo(models.User, {
        foreignKey: "approved_by",
        as: "Approver",
      });
      Vendor.hasMany(models.Product, {
        foreignKey: "vendor_id",
        as: "products" // Add alias for consistency
      });
      Vendor.hasMany(models.Supply, {
        foreignKey: "vendor_id",
      });
      Vendor.hasMany(models.OrderItem, {
        foreignKey: "vendor_id",
      });
      Vendor.hasMany(models.Payout, {
        foreignKey: "vendor_id",
      });
      Vendor.hasMany(models.VendorProductTag, {
        foreignKey: "vendor_id",
      });
      Vendor.hasMany(models.VendorFollower, {
        foreignKey: "vendor_id",
        as: "followers"
      });
    }
  }

  Vendor.init(
    {
      id: {
        type: DataTypes.BIGINT({ unsigned: true }),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT({ unsigned: true }),
        allowNull: false,
        unique: true,
      },
      store_id: {
        type: DataTypes.BIGINT({ unsigned: true }),
        allowNull: false,
        unique: true,
      },
      join_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      total_sales: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      total_earnings: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      last_payment_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "approved",
          "rejected"
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      approved_by: {
        type: DataTypes.BIGINT({ unsigned: true }),
        allowNull: true,
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "Vendor",
      tableName: "vendors",
      timestamps: false,
      underscored: true,
    }
  );

  Vendor.prototype.getVendorDetails = async function () {
    const vendor = await Vendor.findByPk(this.id, {
      include: [
        {
          model: this.sequelize.models.User,
          attributes: ["id", "first_name", "last_name", "email", "phone"],
        },
        {
          model: this.sequelize.models.Store,
          attributes: [
            "slug",
            "business_name",
            "cac_number",
            "instagram_handle",
            "facebook_handle",
            "twitter_handle",
            "business_images",
            "bank_account_name",
            "bank_account_number",
            "bank_name",
            "logo",
            "description",
            "is_verified",
            "status",
          ],
        },
      ],
      attributes: {
        exclude: ["user_id", "store_id", "approved_by"],
      },
      raw: true,
      nest: true,
    });

    return vendor;
  };
  return Vendor;
};
