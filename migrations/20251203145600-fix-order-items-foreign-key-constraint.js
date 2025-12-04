'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, make the product_id column nullable to allow SET NULL
    await queryInterface.changeColumn('order_items', 'product_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true
    });
    
    // Check if the foreign key constraint exists before trying to drop it
    try {
      await queryInterface.removeConstraint('order_items', 'order_items_ibfk_2');
      console.log('Successfully removed existing foreign key constraint order_items_ibfk_2');
    } catch (error) {
      console.log('Foreign key constraint order_items_ibfk_2 does not exist, proceeding to add new constraint');
    }
    
    // Add the new foreign key constraint with SET NULL on delete
    await queryInterface.addConstraint('order_items', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'order_items_ibfk_2',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the new foreign key constraint
    try {
      await queryInterface.removeConstraint('order_items', 'order_items_ibfk_2');
      console.log('Successfully removed foreign key constraint order_items_ibfk_2');
    } catch (error) {
      console.log('Foreign key constraint order_items_ibfk_2 does not exist, proceeding with rollback');
    }
    
    // Add back the original foreign key constraint with NO ACTION
    await queryInterface.addConstraint('order_items', {
      type: 'foreign key',
      fields: ['product_id'],
      name: 'order_items_ibfk_2',
      references: {
        table: 'products',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });
    
    // Make the product_id column NOT NULL again
    await queryInterface.changeColumn('order_items', 'product_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: false
    });
  }
};