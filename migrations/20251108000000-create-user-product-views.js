'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_product_views', {
      id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: false,
        comment: 'User who viewed the product',
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: false,
        comment: 'Product that was viewed',
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      session_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Session ID for guest users'
      },
      viewed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'When the product was viewed'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP address of the viewer'
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent string of the viewer'
      },
      device_type: {
        type: Sequelize.ENUM('desktop', 'mobile', 'tablet', 'unknown'),
        allowNull: true,
        defaultValue: 'unknown',
        comment: 'Detected device type'
      },
      referrer: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URL that referred to this product view'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('user_product_views', {
      name: 'unique_user_product_view',
      unique: true,
      fields: ['user_id', 'product_id']
    });

    await queryInterface.addIndex('user_product_views', {
      name: 'idx_user_views_by_time',
      fields: ['user_id', 'viewed_at']
    });

    await queryInterface.addIndex('user_product_views', {
      name: 'idx_session_views_by_time',
      fields: ['session_id', 'viewed_at']
    });

    await queryInterface.addIndex('user_product_views', {
      name: 'idx_viewed_at',
      fields: ['viewed_at']
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_product_views');
  }
};