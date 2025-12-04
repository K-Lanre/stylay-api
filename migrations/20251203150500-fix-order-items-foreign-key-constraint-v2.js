'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('=== Starting order_items foreign key constraint fix ===');
    
    // Step 1: Make the product_id column nullable to allow SET NULL
    console.log('Step 1: Making product_id column nullable...');
    await queryInterface.changeColumn('order_items', 'product_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true
    });
    console.log('✓ product_id column is now nullable');
    
    // Step 2: Check if foreign key constraint exists and handle accordingly
    console.log('Step 2: Checking for existing foreign key constraint...');
    
    try {
      // Try to get the current foreign key constraint
      const [constraints] = await queryInterface.sequelize.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = 'order_items' 
          AND COLUMN_NAME = 'product_id'
          AND REFERENCED_TABLE_NAME = 'products'
          AND CONSTRAINT_SCHEMA = DATABASE();
      `);
      
      if (constraints.length > 0) {
        const constraintName = constraints[0].CONSTRAINT_NAME;
        console.log(`Found existing constraint: ${constraintName}`);
        
        // Drop the existing constraint
        console.log('Dropping existing constraint...');
        await queryInterface.removeConstraint('order_items', constraintName);
        console.log(`✓ Removed constraint ${constraintName}`);
      } else {
        console.log('No existing foreign key constraint found on product_id');
      }
    } catch (error) {
      console.log('Error checking for existing constraint:', error.message);
      console.log('Proceeding to add new constraint...');
    }
    
    // Step 3: Add the new foreign key constraint with SET NULL on delete
    console.log('Step 3: Adding new foreign key constraint with SET NULL...');
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
    console.log('✓ Added new constraint order_items_ibfk_2 with SET NULL');
    
    console.log('=== Migration completed successfully ===');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('=== Rolling back order_items foreign key constraint fix ===');
    
    // Step 1: Drop the foreign key constraint
    console.log('Step 1: Dropping foreign key constraint...');
    try {
      await queryInterface.removeConstraint('order_items', 'order_items_ibfk_2');
      console.log('✓ Removed constraint order_items_ibfk_2');
    } catch (error) {
      console.log('Constraint order_items_ibfk_2 does not exist, proceeding...');
    }
    
    // Step 2: Add back the original foreign key constraint with NO ACTION
    console.log('Step 2: Adding constraint with NO ACTION...');
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
    console.log('✓ Added constraint with NO ACTION');
    
    // Step 3: Make the product_id column NOT NULL again
    console.log('Step 3: Making product_id column NOT NULL...');
    await queryInterface.changeColumn('order_items', 'product_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: false
    });
    console.log('✓ product_id column is now NOT NULL');
    
    console.log('=== Rollback completed successfully ===');
  }
};