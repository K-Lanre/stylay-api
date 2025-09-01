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
          attributes: ['id'],
          include: [{
            model: Store,
            attributes: ['business_name']
          }]
        }],
        limit: 50, // Limit to 50 products to avoid memory issues
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
        
        // Create 1-2 journal entries per product
        const entryCount = faker.number.int({ min: 1, max: 2 });
        
        for (let i = 0; i < entryCount; i++) {
          const entryDate = faker.date.between({ 
            from: '2023-06-01T00:00:00.000Z', 
            to: new Date().toISOString() 
          });
          
          // Different types of journal entries for products
          const entryTemplates = [
            {
              title: `The Story Behind ${productName}`,
              content: `When ${vendorName} first envisioned ${productName}, they wanted to create something truly special. ${faker.lorem.paragraphs(2)}`
            },
            {
              title: `Crafting ${productName}: A Labor of Love`,
              content: `Creating ${productName} requires meticulous attention to detail. ${faker.lorem.paragraphs(3)}`
            },
            {
              title: `Meet the Maker: The Artisans Behind ${productName}`,
              content: `Behind every ${productName} are the skilled hands of our artisans. ${faker.lorem.paragraphs(2)}`
            },
            {
              title: `The Inspiration for ${productName}`,
              content: `The journey to creating ${productName} began with a simple idea. ${faker.lorem.paragraphs(3)}`
            },
            {
              title: `Caring for Your ${productName}`,
              content: `To ensure your ${productName} lasts for years to come, follow these care instructions. ${faker.lorem.paragraphs(2)}`
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

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('journals', null, {});
    console.log('🗑️  Removed all journal entries.');
  }
};
