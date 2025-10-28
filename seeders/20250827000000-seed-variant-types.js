'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Seed common variant types used in e-commerce
    const variantTypes = [
      {
        name: 'color',
        display_name: 'Color',
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'size',
        display_name: 'Size',
        sort_order: 2,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'material',
        display_name: 'Material',
        sort_order: 3,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'style',
        display_name: 'Style',
        sort_order: 4,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'pattern',
        display_name: 'Pattern',
        sort_order: 5,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'fit',
        display_name: 'Fit',
        sort_order: 6,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'length',
        display_name: 'Length',
        sort_order: 7,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'weight',
        display_name: 'Weight',
        sort_order: 8,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('variant_types', variantTypes);
    console.log(`Seeded ${variantTypes.length} variant types`);
  },

  async down(queryInterface, Sequelize) {
    // Remove all seeded variant types
    await queryInterface.bulkDelete('variant_types', null, {});
    console.log('Removed all seeded variant types');
  }
};
