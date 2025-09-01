'use strict';
const { faker } = require('@faker-js/faker/locale/en_NG');
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get the customer role ID
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'customer' LIMIT 1`
    );
    
    if (roles.length === 0) {
      throw new Error('Customer role not found. Please run the roles seeder first.');
    }
    
    const customerRoleId = roles[0].id;
    const passwordHash = await bcrypt.hash(process.env.DEFAULT_CUSTOMER_PASSWORD, 10);
    const customers = [];
    const userRoles = [];
    const now = new Date();
    
    // Generate 30 customers
    for (let i = 0; i < 30; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ 
        firstName: firstName.toLowerCase(),
        lastName: lastName.toLowerCase(),
        provider: 'stylay.ng'
      });
      
      const customer = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: passwordHash,
        phone: faker.phone.number('+234##########'),
        gender: faker.helpers.arrayElement(['male', 'female', 'other']),
        email_verified_at: now,
        is_active: true,
        created_at: now,
        updated_at: now
      };
      
      customers.push(customer);
    }
    
    // Insert customers
    await queryInterface.bulkInsert('users', customers);
    
    // Get the IDs of the newly inserted users
    const [users] = await queryInterface.sequelize.query(
      `SELECT id FROM users ORDER BY id DESC LIMIT ${customers.length}`
    );
    
    // Create user-role associations
    users.forEach(user => {
      userRoles.push({
        user_id: user.id,
        role_id: customerRoleId,
        created_at: now
      });
    });
    
    // Insert user-role associations
    await queryInterface.bulkInsert('user_roles', userRoles);
  },

  async down(queryInterface, Sequelize) {
    // Get the customer role ID
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'customer' LIMIT 1`
    );
    
    if (roles.length > 0) {
      const customerRoleId = roles[0].id;
      
      // Get all customer user IDs
      const [userRoles] = await queryInterface.sequelize.query(
        `SELECT user_id FROM user_roles WHERE role_id = ${customerRoleId}`
      );
      
      if (userRoles.length > 0) {
        const userIds = userRoles.map(ur => ur.user_id);
        
        // Delete user-role associations
        await queryInterface.bulkDelete('user_roles', {
          role_id: customerRoleId
        });
        
        // Delete users
        await queryInterface.bulkDelete('users', {
          id: userIds
        });
      }
    }
  }
};
