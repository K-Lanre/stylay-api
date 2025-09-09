'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('categories', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      parent_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      image: {
        type: Sequelize.STRING(255),
        allowNull: true
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

    await queryInterface.addIndex('categories', ['parent_id'], { name: 'parent_id' });

    await queryInterface.addConstraint('categories', {
      type: 'foreign key',
      fields: ['parent_id'],
      name: 'categories_ibfk_1',
      references: {
        table: 'categories',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('categories');
  }
};