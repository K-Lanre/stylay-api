'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('stores', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      business_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      cac_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      instagram_handle: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      facebook_handle: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      twitter_handle: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      business_images: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON array of image URLs'
      },
      bank_account_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      bank_account_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      bank_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      logo: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: 0
      },
      status: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '0=inactive, 1=active'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('stores');
  }
};