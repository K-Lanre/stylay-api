'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, make the column nullable
    await queryInterface.sequelize.query(
      'ALTER TABLE inventory MODIFY updated_at DATETIME NULL',
      { raw: true }
    );

    // Then, update all NULL values to current timestamp
    await queryInterface.sequelize.query(
      'UPDATE inventory SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL',
      { raw: true }
    );

    // Finally, set the column to NOT NULL with default CURRENT_TIMESTAMP
    await queryInterface.sequelize.query(
      `ALTER TABLE inventory 
       MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      { raw: true }
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to the original schema if needed
    await queryInterface.sequelize.query(
      'ALTER TABLE inventory MODIFY updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      { raw: true }
    );
  }
};
