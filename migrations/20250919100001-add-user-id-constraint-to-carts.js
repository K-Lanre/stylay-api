'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the foreign key constraint already exists
    const constraints = await queryInterface.getForeignKeyReferencesForTable('carts');

    const userIdConstraintExists = constraints.some(constraint =>
      constraint.columnName === 'user_id' && constraint.tableName === 'carts'
    );

    if (!userIdConstraintExists) {
      // Add foreign key constraint for user_id
      await queryInterface.addConstraint('carts', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'fk_carts_user_id',
        references: {
          table: 'users',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      console.log('Added foreign key constraint fk_carts_user_id to carts table');
    } else {
      console.log('Foreign key constraint fk_carts_user_id already exists');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint
    const constraints = await queryInterface.getForeignKeyReferencesForTable('carts');

    const userIdConstraintExists = constraints.some(constraint =>
      constraint.columnName === 'user_id' && constraint.tableName === 'carts'
    );

    if (userIdConstraintExists) {
      await queryInterface.removeConstraint('carts', 'fk_carts_user_id');
      console.log('Removed foreign key constraint fk_carts_user_id from carts table');
    }
  }
};
