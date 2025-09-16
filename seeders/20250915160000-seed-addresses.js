'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    try {
      // Get all existing users with their phone numbers
      const users = await queryInterface.sequelize.query(
        `SELECT id, first_name, last_name, phone FROM users WHERE phone IS NOT NULL`,
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      if (!users || users.length === 0) {
        console.log('No users found with phone numbers. Skipping address seeding.');
        return;
      }

      // Generate addresses for each user
      const addresses = users.flatMap((user, index) => {
        const userAddresses = [
          {
            user_id: user.id,
            label: 'Home',
            address_line: `${index + 1} Main Street`,
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
            postal_code: `100${index + 1}`,
            phone: user.phone,
            is_default: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            user_id: user.id,
            label: 'Work',
            address_line: `${index + 1} Business Avenue`,
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
            postal_code: `101${index + 1}`,
            phone: user.phone,
            is_default: false,
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        // Add a third address for every 3rd user
        if (index % 3 === 0) {
          userAddresses.push({
            user_id: user.id,
            label: 'Alternate',
            address_line: `${index + 1} Alternative Road`,
            city: 'Abuja',
            state: 'FCT',
            country: 'Nigeria',
            postal_code: `900${index + 1}`,
            phone: user.phone,
            is_default: false,
            created_at: new Date(),
            updated_at: new Date()
          });
        }

        return userAddresses;
      });

      // Insert addresses in batches of 50 to avoid hitting parameter limits
      const batchSize = 50;
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        await queryInterface.bulkInsert('addresses', batch);
      }

      console.log(`Successfully seeded ${addresses.length} addresses for ${users.length} users`);
    } catch (error) {
      console.error('Error seeding addresses:', error);
      throw error;
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('addresses', null, {});
  }
};
