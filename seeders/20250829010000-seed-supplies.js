'use strict';

const { Product, Vendor, Inventory, InventoryHistory, VendorProductTag, sequelize, Sequelize } = require('../models');
const { faker } = require('@faker-js/faker');

// Configuration
const CONFIG = {
  BATCH_SIZE: 100, // Number of supplies to process in each batch
  SUPPLIES_PER_VENDOR: 100, // Number of supply records per vendor
  MIN_QUANTITY: 10,
  MAX_QUANTITY: 100
};

// Progress tracking
class ProgressLogger {
  constructor(total) {
    this.total = total;
    this.processed = 0;
    this.startTime = Date.now();
  }

  update(increment = 1) {
    this.processed += increment;
    const percentage = ((this.processed / this.total) * 100).toFixed(1);
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const rate = (this.processed / (elapsed || 1)).toFixed(1);
    
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`Processing: ${this.processed}/${this.total} (${percentage}%) | ${rate} recs/sec`);
    
    if (this.processed >= this.total) {
      process.stdout.write('\n');
    }
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Find all vendors with their products and ensure they're approved
      const vendors = await Vendor.findAll({
        include: [
          {
            model: Product,
            as: 'products', // Changed from 'Products' to 'products' to match model association
            attributes: ['id'],
            required: true
          },
          {
            model: sequelize.models.Store,
            as: 'store',
            attributes: [],
            where: { is_verified: true },
            required: true
          }
        ],
        where: { status: 'approved' },
        transaction
      });

      if (vendors.length === 0) {
        console.log('No approved vendors with products found. Skipping supply seeding.');
        return;
      }

      console.log('\nGenerating supply data...');
      const currentDate = new Date();
      const supplies = [];
      const vendorProductTagsToCreate = [];

      // Get all products from approved vendors
      const products = await Product.findAll({
        include: [{
          model: Vendor,
          as: 'vendor',
          where: {
            status: 'approved',
            id: { [Sequelize.Op.in]: vendors.map(v => v.id) }
          },
          include: [{
            model: sequelize.models.Store,
            as: 'store',
            where: { is_verified: true },
            required: true
          }]
        }],
        transaction
      });

      if (products.length === 0) {
        console.log('No products found from approved vendors. Skipping supply seeding.');
        return;
      }

      console.log(`\nFound ${products.length} products from approved vendors`);

      // Generate all supplies data first
      const vendorProductMap = new Map();
      
      // Group products by vendor
      products.forEach(product => {
        if (!vendorProductMap.has(product.vendor_id)) {
          vendorProductMap.set(product.vendor_id, []);
        }
        vendorProductMap.get(product.vendor_id).push(product);
      });

      // Generate supplies for each vendor's products
      for (const [vendorId, vendorProducts] of vendorProductMap.entries()) {
        const productsToUse = vendorProducts.slice(0, CONFIG.SUPPLIES_PER_VENDOR);
        
        for (const product of productsToUse) {
          // Ensure a VendorProductTag exists for this vendor-product pair
          let vendorProductTag = await VendorProductTag.findOne({
            where: {
              vendor_id: vendorId,
              product_id: product.id
            },
            transaction
          });

          if (!vendorProductTag) {
            // If not found, create a new one
            vendorProductTag = await VendorProductTag.create({
              vendor_id: vendorId,
              product_id: product.id,
              created_at: new Date()
            }, { transaction });
          }

          const quantity = faker.number.int({
            min: CONFIG.MIN_QUANTITY,
            max: CONFIG.MAX_QUANTITY
          });
          
          supplies.push({
            vendor_id: vendorId,
            product_id: product.id,
            vendor_product_tag_id: vendorProductTag.id,
            quantity_supplied: quantity,
            supply_date: faker.date.between({
              from: new Date(currentDate.getFullYear(), 0, 1),
              to: currentDate
            }),
            created_at: new Date()
            // updated_at is handled by the model's timestamps
          });
        }
      }
      
      console.log(`Generated ${supplies.length} supply records`);

      if (supplies.length > 0) {
        console.log('\nInserting supplies...');
        
        // Process in batches
        const totalBatches = Math.ceil(supplies.length / CONFIG.BATCH_SIZE);
        const progress = new ProgressLogger(supplies.length);
        
        for (let i = 0; i < supplies.length; i += CONFIG.BATCH_SIZE) {
          const batch = supplies.slice(i, i + CONFIG.BATCH_SIZE);
          
          // Insert batch of supplies
          await queryInterface.bulkInsert('supply', batch, {
            transaction
          });

          // For MySQL, we need to get the inserted IDs differently
          // Since bulkInsert doesn't return IDs in MySQL, we'll process inventory without supply_id for now and update later
          const insertedSupplies = await queryInterface.sequelize.query(
            `SELECT id, product_id FROM supply WHERE product_id IN (${batch.map(s => s.product_id).join(',')})`,
            { transaction, type: Sequelize.QueryTypes.SELECT }
          );

          const supplyMap = new Map(insertedSupplies.map(supply => [supply.product_id, supply.id]));

          await Promise.all(batch.map(async (supply) => {
            const productId = supply.product_id;
            const quantity = supply.quantity_supplied;
            const [inventory, created] = await Inventory.findOrCreate({
              where: { product_id: productId },
              defaults: {
                product_id: productId,
                supply_id: supplyMap.get(productId) || null, // Update supply_id here
                stock: quantity, // Set initial stock to the supplied quantity
                restocked_at: new Date(),
                created_at: new Date(),
                updated_at: new Date()
              },
              transaction
            });
            
            // Prepare inventory history record
            const historyData = {
              inventory_id: inventory.id,
              adjustment: quantity,
              note: 'Stock from supply',
              adjusted_by: 1, // Admin user ID
              created_at: new Date(),
              updated_at: new Date()
            };
            
            if (!created) {
              // Update existing inventory
              const previousStock = inventory.stock;
              const newStock = previousStock + quantity;
              
              await Inventory.update(
                {
                  stock: newStock,
                  restocked_at: new Date(),
                  updated_at: new Date()
                },
                {
                  where: { id: inventory.id },
                  transaction
                }
              );
              
              // Set history data for existing inventory
              historyData.previous_stock = previousStock;
              historyData.new_stock = newStock;
            } else {
              // Set history data for new inventory
              historyData.previous_stock = 0;
              historyData.new_stock = quantity;
            }
            
            return historyData;
          }));
          
          progress.update(batch.length);
        }
        
        console.log('\nProcessing completed successfully!');
      }

      await transaction.commit();
      console.log(`Successfully seeded ${supplies.length} supply records`);
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error seeding supplies:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('supply', null, {});
    await queryInterface.bulkDelete('vendor_product_tags', null, {}); // Clean up associated tags
  }
};
