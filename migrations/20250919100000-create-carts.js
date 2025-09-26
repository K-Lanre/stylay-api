'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('carts', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: 'ID of the authenticated user, null for guest carts'
      },
      session_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Session ID for guest users'
      },
      total_items: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total number of items in the cart'
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total monetary amount of all items in the cart'
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

    // Add indexes for better query performance
    await queryInterface.addIndex('carts', ['user_id'], {
      name: 'carts_user_id_idx'
    });

    await queryInterface.addIndex('carts', ['session_id'], {
      name: 'carts_session_id_idx'
    });

    // Add composite index for user_id and session_id (since a user might have both authenticated and guest carts)
    await queryInterface.addIndex('carts', ['user_id', 'session_id'], {
      name: 'carts_user_session_idx'
    });

    // Add foreign key constraint for user_id
    await queryInterface.addConstraint('carts', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_carts_user_id',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint first
    await queryInterface.removeConstraint('carts', 'fk_carts_user_id');
    await queryInterface.dropTable('carts');
  }
};
