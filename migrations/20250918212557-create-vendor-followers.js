'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('vendor_followers', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        comment: 'ID of the user who is following'
      },
      vendor_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        comment: 'ID of the vendor being followed'
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

    // Add unique constraint to prevent duplicate follows
    await queryInterface.addIndex('vendor_followers', ['user_id', 'vendor_id'], {
      unique: true,
      name: 'vendor_followers_user_vendor_unique'
    });

    await queryInterface.addIndex('vendor_followers', ['vendor_id'], { name: 'vendor_followers_vendor_id_idx' });
    await queryInterface.addIndex('vendor_followers', ['user_id'], { name: 'vendor_followers_user_id_idx' });
    await queryInterface.addIndex('vendor_followers', ['created_at'], { name: 'vendor_followers_created_at_idx' });

    // Foreign key constraints
    await queryInterface.addConstraint('vendor_followers', {
      type: 'foreign key',
      fields: ['user_id'],
      name: 'vendor_followers_ibfk_1',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('vendor_followers', {
      type: 'foreign key',
      fields: ['vendor_id'],
      name: 'vendor_followers_ibfk_2',
      references: {
        table: 'vendors',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('vendor_followers');
  }
};
