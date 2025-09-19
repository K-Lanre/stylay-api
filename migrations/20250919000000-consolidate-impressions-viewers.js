'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if viewers column exists before attempting to drop it
    const tableDescription = await queryInterface.describeTable('products');

    if (tableDescription.viewers) {
      // Drop the viewers column as it's functionally equivalent to impressions
      await queryInterface.removeColumn('products', 'viewers');
      console.log('Successfully dropped viewers column from products table');
    } else {
      console.log('Viewers column does not exist, skipping drop operation');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Add back the viewers column if needed to rollback
    const tableDescription = await queryInterface.describeTable('products');

    if (!tableDescription.viewers) {
      await queryInterface.addColumn('products', 'viewers', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
        after: 'impressions' // Add after impressions column
      });
      console.log('Successfully added back viewers column to products table');
    } else {
      console.log('Viewers column already exists, skipping add operation');
    }
  }
};
