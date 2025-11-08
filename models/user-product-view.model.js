'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserProductView extends Model {
    static associate(models) {
      // User who viewed the product
      UserProductView.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
      
      // Product that was viewed
      UserProductView.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
      });
    }
  }

  UserProductView.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'id'
    },
    user_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      comment: 'User who viewed the product'
    },
    product_id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      comment: 'Product that was viewed'
    },
    session_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Session ID for guest users'
    },
    viewed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the product was viewed'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP address of the viewer (for security/analytics)'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent string of the viewer'
    },
    device_type: {
      type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'unknown'),
      allowNull: true,
      defaultValue: 'unknown',
      comment: 'Detected device type'
    },
    referrer: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL that referred to this product view'
    }
  }, {
    sequelize,
    modelName: 'UserProductView',
    tableName: 'user_product_views',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'product_id'],
        name: 'unique_user_product_view'
      },
      {
        fields: ['user_id', 'viewed_at'],
        name: 'idx_user_views_by_time'
      },
      {
        fields: ['session_id', 'viewed_at'],
        name: 'idx_session_views_by_time'
      },
      {
        fields: ['viewed_at'],
        name: 'idx_viewed_at'
      }
    ]
  });

  // Instance method to get anonymized data
  UserProductView.prototype.getAnonymizedData = function() {
    return {
      id: this.id,
      product_id: this.product_id,
      viewed_at: this.viewed_at,
      device_type: this.device_type,
      // Remove personal identifiers
      ip_address: this.ip_address ? this.ip_address.substring(0, 8) + 'xxx' : null,
      user_agent: this.user_agent ? 'Anonymized' : null,
      referrer: this.referrer
    };
  };

  // Class method to clean old views
  UserProductView.cleanOldViews = async function(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    return await UserProductView.destroy({
      where: {
        viewed_at: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
  };

  return UserProductView;
};