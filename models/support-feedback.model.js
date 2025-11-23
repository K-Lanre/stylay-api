// models/support_feedback.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SupportFeedback extends Model {
    static associate(models) {
      SupportFeedback.belongsTo(models.User, {
        foreignKey: 'user_id'
      });
    }
  }

  SupportFeedback.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    order_number: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    issue_type: {
      type: DataTypes.ENUM(
        'Order Not Delivered',
        'Wrong Item Received',
        'Payment Issue',
        'Return/Refund Request',
        'Account Issue',
        'Technical Issue',
        'Other'
      ),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    preferred_support_method: {
      type: DataTypes.ENUM('Email', 'Phone', 'Chat'),
      allowNull: false
    },
    contact_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    contact_phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    attachments: {
      type: DataTypes.JSON,
      allowNull: true
    },
    reference_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'closed'),
      allowNull: false,
      defaultValue: 'open'
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
    modelName: 'SupportFeedback',
    tableName: 'support_feedback',
    timestamps: true,
    underscored: true
  });

  SupportFeedback.beforeCreate((instance) => {
    instance.created_at = new Date();
    instance.updated_at = new Date();
  });

  SupportFeedback.beforeUpdate((instance) => {
    instance.updated_at = new Date();
  });

  return SupportFeedback;
};