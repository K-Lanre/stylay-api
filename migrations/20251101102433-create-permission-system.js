'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Create permissions table
    await queryInterface.createTable('permissions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Permission name (e.g., manage_products)'
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'URL-friendly permission name (e.g., manage-products)'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Human-readable description of the permission'
      },
      resource: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Resource this permission applies to (e.g., products, orders)'
      },
      action: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Action this permission allows (e.g., create, read, update, delete)'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Create permission_roles junction table
    await queryInterface.createTable('permission_roles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      permission_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'permissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Create permission_users junction table for direct user permissions
    await queryInterface.createTable('permission_users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      permission_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'permissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('permissions', ['resource']);
    await queryInterface.addIndex('permissions', ['action']);
    await queryInterface.addIndex('permissions', ['resource', 'action']);
    await queryInterface.addIndex('permissions', ['name']);
    await queryInterface.addIndex('permissions', ['slug']);

    // Add composite unique constraint to prevent duplicate role-permission assignments
    await queryInterface.addIndex('permission_roles', ['role_id', 'permission_id'], {
      unique: true,
      name: 'unique_role_permission'
    });
    // Add indexes for performance
    await queryInterface.addIndex('permission_roles', ['role_id']);
    await queryInterface.addIndex('permission_roles', ['permission_id']);

    // Add composite unique constraint to prevent duplicate user-permission assignments
    await queryInterface.addIndex('permission_users', ['user_id', 'permission_id'], {
      unique: true,
      name: 'unique_user_permission'
    });
    // Add indexes for performance
    await queryInterface.addIndex('permission_users', ['user_id']);
    await queryInterface.addIndex('permission_users', ['permission_id']);
  },

  async down (queryInterface, Sequelize) {
    // Drop tables in reverse order to avoid foreign key constraint issues
    await queryInterface.dropTable('permission_users');
    await queryInterface.dropTable('permission_roles');
    await queryInterface.dropTable('permissions');
  }
};
