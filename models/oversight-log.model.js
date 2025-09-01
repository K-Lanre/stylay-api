// models/oversight_log.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OversightLog extends Model {
    static associate(models) {
      OversightLog.belongsTo(models.User, {
        foreignKey: 'admin_id'
      });
    }
  }

  OversightLog.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    admin_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false
    },
    functionality: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    action: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    modelName: 'OversightLog',
    tableName: 'oversight_logs',
    timestamps: false,
    underscored: true
  });

  return OversightLog;
};