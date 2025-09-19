'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if the column exists before trying to remove it
    const [results] = await queryInterface.sequelize.query(
      `SELECT * FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = '${queryInterface.sequelize.config.database}' 
       AND TABLE_NAME = 'orders' 
       AND COLUMN_NAME = 'address_id'`
    );

    if (results.length > 0) {
      await queryInterface.removeColumn('orders', 'address_id');
    }
  },

  async down(queryInterface, Sequelize) {
    // Add the column back if we need to rollback
    await queryInterface.addColumn('orders', 'address_id', {
      type: Sequelize.BIGINT({ unsigned: true }),
      allowNull: true,
      references: {
        model: 'addresses',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  }
};
