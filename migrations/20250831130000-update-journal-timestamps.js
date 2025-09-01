'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the old timestamp columns
    await queryInterface.removeColumn('journals', 'created_at');
    await queryInterface.removeColumn('journals', 'updated_at');
    
    // Add new timestamp columns with proper configuration
    await queryInterface.addColumn('journals', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    
    await queryInterface.addColumn('journals', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert the changes if needed
    await queryInterface.removeColumn('journals', 'created_at');
    await queryInterface.removeColumn('journals', 'updated_at');
    
    // Add back the original columns if they had different configurations
    await queryInterface.addColumn('journals', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    
    await queryInterface.addColumn('journals', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
  }
};
