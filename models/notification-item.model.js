// models/notification_item.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NotificationItem extends Model {
    static associate(models) {
      NotificationItem.belongsTo(models.Notification, {
        foreignKey: 'notification_id'
      });
    }
  }

  NotificationItem.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    notification_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    item_details: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    modelName: 'NotificationItem',
    tableName: 'notification_items',
    timestamps: false,
    underscored: true
  });

  return NotificationItem;
};