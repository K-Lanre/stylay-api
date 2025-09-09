'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'dob', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'User\'s date of birth',
      after: 'email',
      validate: {
        isDate: {
          msg: 'Please provide a valid date of birth'
        },
        isBefore: new Date().toISOString().split('T')[0],
        isAfter: '1900-01-01'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'dob');
  }
};
