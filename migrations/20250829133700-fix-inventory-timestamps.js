'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Use a single raw SQL statement to modify the column
    // This works for both MySQL and MariaDB
    await queryInterface.sequelize.query(
      `ALTER TABLE inventory 
       MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      { raw: true }
    );
    
    // Remove the ON UPDATE CURRENT_TIMESTAMP if it exists (MySQL specific)
    await queryInterface.sequelize.query(
      `ALTER TABLE inventory 
       CHANGE COLUMN updated_at updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      { raw: true }
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to the original schema if needed
    await queryInterface.changeColumn('inventory', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    });
  }
};
