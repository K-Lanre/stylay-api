'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const roles = [
      {
        name: 'customer',
        description: 'Regular customer with basic access',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'vendor',
        description: 'Vendor with product management access',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'admin',
        description: 'Administrator with full system access',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'sub-admin',
        description: 'Sub-administrator with limited administrative access',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('roles', roles, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('roles', { name: ['customer', 'vendor', 'admin', 'sub-admin'] }, {});
  }
};
