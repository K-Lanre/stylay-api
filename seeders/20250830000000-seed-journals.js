'use strict';

const { faker } = require('@faker-js/faker');
const { Product, Vendor, Store } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Get all products with their vendor and store information using Sequelize
      const products = await Product.findAll({
        attributes: ['id', 'name', 'vendor_id'],
        include: [{
          model: Vendor,
          as: 'vendor',
          attributes: ['id'],
          include: [{
            model: Store,
            as: 'store',
            attributes: ['business_name']
          }]
        }],
        limit: 150, // Limit to 150 products to generate exactly 150 journal records
        transaction,
        raw: true,
        nest: true
      });

      // Transform the data to match our expected format
      const formattedProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        vendor_id: product.vendor_id,
        vendor_name: product.Vendor?.Store?.business_name || 'our artisans'
      }));

      if (formattedProducts.length === 0) {
        throw new Error('No products found in the database. Please seed products first.');
      }

      console.log(`Found ${formattedProducts.length} products to create journal entries for.`);
      const journals = [];
      
      // Create journal entries for each product
      for (const [index, product] of formattedProducts.entries()) {
 
        const productName = product.name;
        const vendorName = product.vendor_name;

        // Simulate real-time events
        const impressions = faker.number.int({ min: 10, max: 100 });
        const soldUnits = faker.number.int({ min: 1, max: 5 });

        // Create exactly 1 journal entry per product to ensure exactly 150 total records
        const entryCount = 1;
        
        for (let i = 0; i < entryCount; i++) {
          const entryDate = faker.date.between({ 
            from: '2023-06-01T00:00:00.000Z', 
            to: new Date().toISOString() 
          });
          
          // Different types of journal entries for products
          const entryTemplates = [
            {
              title: `${productName} - Price Update`,
              content: `The price of ${productName} has been updated to $${faker.commerce.price()}.`
            },
            {
              title: `${productName} - Discount Alert!`,
              content: `Get ${productName} now at a discounted price of $${faker.commerce.price()}! Limited time offer.`
            },
            {
              title: `${productName} - Trending Now`,
              content: `People are loving ${productName}! It's currently trending with ${faker.number.int({ min: 100, max: 500 })} views today.`
            },
            {
              title: `${productName} - Sold Out`,
              content: `Unfortunately, ${productName} is currently sold out. We're working hard to restock it soon!`
            },
            {
              title: `${productName} - Back in Stock!`,
              content: `Great news! ${productName} is back in stock. Order now before it sells out again.`
            },
            {
              title: `${productName} - New Review`,
              content: `A customer just posted a glowing review about ${productName}: "${faker.lorem.sentence()}"`
            },
            {
              title: `${productName} - Low Stock Alert`,
              content: `Hurry! Only a few units of ${productName} left in stock.`
            },
            {
              title: `${productName} - New Order`,
              content: `Someone just ordered ${faker.number.int({ min: 1, max: 5 })} units of ${productName}!`
            },
            {
              title: `${productName} - Added to Wishlist`,
              content: `Someone just added ${productName} to their wishlist!`
            }
          ];
          
          const entry = faker.helpers.arrayElement(entryTemplates);
          
          journals.push({
            title: entry.title,
            content: entry.content,
            product_id: product.id,
            created_at: entryDate,
            updated_at: entryDate
          });
        }
        
        // Log progress
        if ((index + 1) % 10 === 0 || index === products.length - 1) {
          console.log(`Processed ${index + 1}/${products.length} products`);
        }
      }
      
      // Create additional product-specific journal entries instead of general ones
      // This ensures all journal entries have a valid product_id
      const additionalEntries = Math.max(10, Math.ceil(formattedProducts.length * 0.2));
      
      for (let i = 0; i < additionalEntries; i++) {
        // Reuse existing products to create more entries
        const product = faker.helpers.arrayElement(formattedProducts);
        const productName = product.name;
        const vendorName = product.vendor_name;
        
        const entryDate = faker.date.between({ 
          from: '2023-01-01T00:00:00.000Z', 
          to: new Date().toISOString() 
        });
        
        const entryTemplates = [
          {
            title: `The Making of ${productName}`,
            content: `Discover the intricate process behind creating ${productName} by ${vendorName}. ${faker.lorem.paragraphs(3)}`
          },
          {
            title: `${productName}: A Closer Look`,
            content: `Explore the unique features and craftsmanship of ${productName}. ${faker.lorem.paragraphs(2)}`
          },
          {
            title: `Behind the Scenes: ${productName} Creation`,
            content: `Go behind the scenes to see how ${vendorName} brings ${productName} to life. ${faker.lorem.paragraphs(3)}`
          }
        ];
        
        const entry = faker.helpers.arrayElement(entryTemplates);
        
        journals.push({
          title: entry.title,
          content: entry.content,
          product_id: product.id,
          created_at: entryDate,
          updated_at: entryDate
        });
      }

      // Sort by created_at to maintain chronological order
      journals.sort((a, b) => a.created_at - b.created_at);

      // Batch insert for better performance
      const BATCH_SIZE = 50;
      for (let i = 0; i < journals.length; i += BATCH_SIZE) {
        const batch = journals.slice(i, i + BATCH_SIZE);
        await queryInterface.bulkInsert('journals', batch, { transaction });
        console.log(`Inserted batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(journals.length/BATCH_SIZE)}`);
      }
      
      await transaction.commit();
      console.log(`✅ Successfully seeded ${journals.length} journal entries.`);
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding journals:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });
      await queryInterface.bulkDelete('journals', null, {});
      console.log('🗑️  Removed all journal entries.');
    } finally {
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });
    }
  }
};
