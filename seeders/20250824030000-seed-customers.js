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
    const usedPhoneNumbers = new Set();
    const usedEmails = new Set();

    // Generate 1000 customers in batches of 100
    const totalCustomers = 1000;
    const batchSize = 100;
    const numBatches = Math.ceil(totalCustomers / batchSize);

    for (let batch = 0; batch < numBatches; batch++) {
      const batchCustomers = [];
      const batchUserRoles = [];
      const currentBatchSize = Math.min(batchSize, totalCustomers - (batch * batchSize));
      
      // Generate a batch of customers
      for (let i = 0; i < currentBatchSize; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      // Generate unique email
      let email = faker.internet.email({
        firstName: firstName.toLowerCase(),
        lastName: lastName.toLowerCase(),
        provider: 'stylay.ng'
      });

      // Ensure email uniqueness
      let emailCounter = 1;
      while (usedEmails.has(email)) {
        email = faker.internet.email({
          firstName: firstName.toLowerCase(),
          lastName: lastName.toLowerCase(),
          provider: `stylay${emailCounter}.ng`
        });
        emailCounter++;
      }
      usedEmails.add(email);

      // Generate unique phone number
      let phone = `+234${faker.helpers.arrayElement(['70', '80', '81', '90', '91'])}${faker.string.numeric(8)}`;
      let phoneCounter = 1;
      while (usedPhoneNumbers.has(phone)) {
        phone = `+234${faker.helpers.arrayElement(['70', '80', '81', '90', '91'])}${faker.string.numeric(8)}`;
        phoneCounter++;
      }
      usedPhoneNumbers.add(phone);

      const customer = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: passwordHash,
        phone: phone,
        gender: faker.helpers.arrayElement(['male', 'female', 'other']),
        email_verified_at: now,
        created_at: now,
        updated_at: now
      };

      batchCustomers.push(customer);
      }

      // Insert the current batch of customers
      if (batchCustomers.length > 0) {
        const insertedUsers = await queryInterface.bulkInsert('users', batchCustomers, { returning: true });
        
        // Add user-role relationships for this batch
        for (let i = 0; i < batchCustomers.length; i++) {
          const userId = typeof insertedUsers === 'number' ? insertedUsers + i : insertedUsers[i].id;
          batchUserRoles.push({
            user_id: userId,
            role_id: customerRoleId,
            created_at: now
          });
        }
        
        // Insert user-role relationships for this batch
        if (batchUserRoles.length > 0) {
          await queryInterface.bulkInsert('user_roles', batchUserRoles);
        }
        
        console.log(`Inserted ${batchCustomers.length} customers in batch ${batch + 1}/${numBatches}`);
      }
    }

  },

  async down(queryInterface, Sequelize) {
    // Helper function to get customer role ID
    const getCustomerRoleId = async () => {
      const [roles] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE name = 'customer' LIMIT 1`
      );
      
      if (roles.length === 0) {
        throw new Error('Customer role not found');
      }
      
      return roles[0].id;
    };

    // Delete all user-role relationships first to avoid foreign key constraint
    await queryInterface.bulkDelete('user_roles', { 
      role_id: await getCustomerRoleId() 
    });
    
    // Then delete users
    return queryInterface.bulkDelete('users', { 
      id: { [Sequelize.Op.gte]: 1 } 
    });
  }
};
