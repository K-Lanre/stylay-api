'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // First, check if we're using MySQL/MariaDB
      const [results] = await queryInterface.sequelize.query("SELECT VERSION() as version");
      const isMariaDB = results[0].version.includes('MariaDB');
      
      if (isMariaDB) {
        // For MariaDB
        await queryInterface.sequelize.query(
          `ALTER TABLE inventory 
           MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`,
          { raw: true }
        );
      } else {
        // For MySQL
        await queryInterface.sequelize.query(
          `ALTER TABLE inventory 
           MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
          { raw: true }
        );
      }
      
      console.log('Successfully updated inventory.updated_at column');
    } catch (error) {
      console.error('Error updating inventory.updated_at column:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to the original schema if needed
    await queryInterface.sequelize.query(
      'ALTER TABLE inventory MODIFY updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      { raw: true }
    );
  }
};
