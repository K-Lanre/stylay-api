'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First, update any 'registration_complete' statuses to 'approved' since they've completed registration
    await queryInterface.sequelize.query(
      `UPDATE vendors SET status = 'approved' WHERE status = 'registration_complete'`
    );

    // Then modify the enum type
    const query = `
      ALTER TABLE vendors 
      MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') 
      NOT NULL DEFAULT 'pending';
    `;
    
    await queryInterface.sequelize.query(query);
  },

  async down(queryInterface, Sequelize) {
    // To rollback, we need to add back the 'registration_complete' status
    // First, update the column to allow NULL temporarily
    await queryInterface.sequelize.query(
      `ALTER TABLE vendors MODIFY COLUMN status VARCHAR(50) NULL;`
    );
    
    // Then modify the column to include the old enum values
    await queryInterface.sequelize.query(`
      ALTER TABLE vendors 
      MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'registration_complete') 
      NOT NULL DEFAULT 'pending';
    `);
  }
};
