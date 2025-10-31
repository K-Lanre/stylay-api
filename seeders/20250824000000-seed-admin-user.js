'use strict';
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get the admin role ID
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'admin'"
    );

    if (roles.length === 0) {
      throw new Error('Admin role not found. Please run the roles seeder first.');
    }
    
    const adminRoleId = roles[0].id;
    const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD, 12);
    const now = new Date();

    // Define admin user details
    const first_name = 'Admin';
    const last_name = 'User';

    // Insert admin user with a reliably formatted phone number
    await queryInterface.bulkInsert('users', [
      {
        first_name: first_name,
        last_name: last_name,
        email: 'admin@stylay.com',
        password: hashedPassword,
        // Ensure phone number follows +234[70|80|81|90|91]XXXXXXX format
        phone: `+234${faker.helpers.arrayElement(['70', '80', '81', '90', '91'])}${faker.string.numeric(8)}`, // +234 followed by valid prefix and 8 digits
        profile_image: `https://ui-avatars.com/api/?name=${first_name}+${last_name}&background=random&size=128`,
        gender: 'other',
        is_active: true,
        email_verified_at: now,
        created_at: now,
        updated_at: now
      }
    ]);

    // Get the newly inserted admin user's ID
    const [adminUsers] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@stylay.com'"
    );
    
    if (adminUsers.length === 0) {
        throw new Error('Could not find admin user after insertion.');
    }
    const adminUser = adminUsers[0];

    // Assign admin role to the user
    await queryInterface.bulkInsert('user_roles', [
      {
        user_id: adminUser.id,
        role_id: adminRoleId,
        created_at: now
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    // Find the admin user by email to ensure we delete the correct one
    const [users] = await queryInterface.sequelize.query(
        "SELECT id FROM users WHERE email = 'admin@stylay.com'"
    );

    if (users.length > 0) {
      const adminUserId = users[0].id;
      // First, delete the role assignment from the junction table
      await queryInterface.bulkDelete('user_roles', { user_id: adminUserId });
    }

    // Then, delete the user from the users table
    await queryInterface.bulkDelete('users', { email: 'admin@stylay.com' });
  }
};
