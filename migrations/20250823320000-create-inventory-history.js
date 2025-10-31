'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_history', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      inventory_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'inventory',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      adjustment: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Positive for stock in, negative for stock out'
      },
      previous_stock: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      new_stock: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      adjusted_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "The user who made the adjustment",
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('inventory_history', ['inventory_id']);
    await queryInterface.addIndex('inventory_history', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('inventory_history');
  }
};
