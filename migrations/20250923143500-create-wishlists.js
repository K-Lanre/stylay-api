'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('wishlists', {
      id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.BIGINT({ unsigned: true }),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this is the default wishlist for the user (only one per user)'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    }, {
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'is_default'],
          where: {
            is_default: true
          }
        },
        {
          fields: ['user_id']
        },
        {
          fields: ['is_public']
        }
      ]
    });

  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('wishlists');
  }
};
