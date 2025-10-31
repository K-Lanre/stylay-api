'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the unique constraint on product_id in inventory table
    // This allows multiple inventory records per product (one per supply)
    console.log('Removing unique constraint on inventory.product_id...');

    // Use raw SQL to ensure we drop the constraint regardless of its name
    const queries = [
      'ALTER TABLE inventory DROP INDEX product_id',
      'ALTER TABLE inventory DROP INDEX product_id_2',
      'ALTER TABLE inventory DROP INDEX `product_id`',
      'ALTER TABLE inventory DROP INDEX `product_id_2`'
    ];

    let success = false;
    for (const query of queries) {
      try {
        await queryInterface.sequelize.query(query);
        console.log(`Successfully executed: ${query}`);
        success = true;
        break;
      } catch (error) {
        // Continue to next query
        console.log(`Query failed: ${query} - ${error.message}`);
      }
    }

    if (!success) {
      // Last resort: try to change the column definition
      try {
        await queryInterface.changeColumn('inventory', 'product_id', {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false
          // Remove unique: true by not specifying it
        });
        console.log('Changed column definition to remove uniqueness');
        success = true;
      } catch (changeError) {
        console.log('Column change failed:', changeError.message);
        throw new Error('Could not remove unique constraint on inventory.product_id. Manual database intervention required.');
      }
    }

    if (success) {
      console.log('Unique constraint successfully removed from inventory.product_id');
    }

    // Add a composite index for better performance
    try {
      await queryInterface.addIndex('inventory', ['product_id', 'supply_id'], {
        name: 'inventory_product_supply_idx'
      });
      console.log('Added composite index on inventory (product_id, supply_id)');
    } catch (indexError) {
      console.log('Failed to add composite index:', indexError.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Revert: remove the composite index
    try {
      await queryInterface.removeIndex('inventory', 'inventory_product_supply_idx');
      console.log('Removed composite index');
    } catch (error) {
      console.log('Composite index removal failed:', error.message);
    }

    // Revert: add back the unique constraint on product_id
    try {
      await queryInterface.changeColumn('inventory', 'product_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true
      });
      console.log('Restored unique constraint on inventory.product_id');
    } catch (error) {
      console.log('Failed to restore unique constraint:', error.message);
      throw error;
    }
  }
};