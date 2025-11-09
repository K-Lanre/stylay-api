'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('token_blacklist', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
        comment: 'SHA256 hash of the blacklisted token'
      },
      token_expiry: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'Unix timestamp when the original token expires'
      },
      blacklisted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'When the token was blacklisted'
      },
      reason: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'logout',
        comment: 'Reason for blacklisting (logout, password_change, etc.)'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID of the user whose token was blacklisted (if applicable)'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('token_blacklist', {
      name: 'idx_token_blacklist_hash',
      unique: true,
      fields: ['token_hash']
    });

    await queryInterface.addIndex('token_blacklist', {
      name: 'idx_token_blacklist_expiry',
      fields: ['token_expiry']
    });

    await queryInterface.addIndex('token_blacklist', {
      name: 'idx_token_blacklist_user',
      fields: ['user_id']
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('token_blacklist');
  }
};