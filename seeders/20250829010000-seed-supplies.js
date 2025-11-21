'use strict';

const { Product, Vendor, VendorProductTag, VariantCombination, sequelize, User } = require('../models');
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

      // Find admin user for inventory history
      const adminUser = await User.findOne({
        where: { email: 'admin@stylay.com' }
      });

      if (!adminUser) {
        throw new Error('Admin user not found. Please run the admin user seeder first.');
      }

      console.log(`Found admin user with ID: ${adminUser.id}`);

      // Debug: Log initial state
      console.log(`Starting with ${vendors.length} approved vendors`);

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

      // Generate supplies for each vendor's product combinations
      for (const [vendorId, vendorProducts] of vendorProductMap.entries()) {
        const productsToUse = vendorProducts.slice(0, CONFIG.SUPPLIES_PER_VENDOR);

        for (const product of productsToUse) {
          // Get combinations for this product
          const combinations = await VariantCombination.findAll({
            where: { product_id: product.id },
            attributes: ['id', 'product_id', 'combination_name'],
            transaction
          });

          if (combinations.length === 0) {
            console.log(`No combinations found for product ${product.id}, skipping supply`);
            continue;
          }

          console.log(`Product ${product.id} has ${combinations.length} combinations`);

          // Ensure a VendorProductTag exists for this vendor-product pair
          let vendorProductTag = await VendorProductTag.findOne({
            where: {
              vendor_id: vendorId,
              product_id: product.id
            },
            transaction
          });

          if (!vendorProductTag) {
            console.log(`Creating VendorProductTag for vendor ${vendorId} and product ${product.id}`);
            // If not found, create a new one
            vendorProductTag = await VendorProductTag.create({
              vendor_id: vendorId,
              product_id: product.id,
              created_at: new Date()
            }, { transaction });
          } else {
            console.log(`Found existing VendorProductTag ${vendorProductTag.id} for vendor ${vendorId} and product ${product.id}`);
          }

          // Generate supplies for each combination
          for (const combination of combinations) {
            const quantity = faker.number.int({
              min: CONFIG.MIN_QUANTITY,
              max: CONFIG.MAX_QUANTITY
            });

            supplies.push({
              vendor_id: vendorId,
              product_id: product.id,
              vendor_product_tag_id: vendorProductTag.id,
              combination_id: combination.id, // Add combination reference
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
      }

      console.log(`Generated ${supplies.length} supply records`);

      if (supplies.length > 0) {
        console.log('\nInserting supplies and updating inventory...');

        // Process in batches
        const totalBatches = Math.ceil(supplies.length / CONFIG.BATCH_SIZE);
        const progress = new ProgressLogger(supplies.length);

        for (let i = 0; i < supplies.length; i += CONFIG.BATCH_SIZE) {
          const batch = supplies.slice(i, i + CONFIG.BATCH_SIZE);

          console.log(`Processing batch of ${batch.length} supplies`);

          // Insert batch of supplies
           const insertedSupplies = await queryInterface.bulkInsert('supply', batch, {
             transaction,
             returning: true
           });

           // Get the inserted supply IDs
           const supplyIds = [];
           if (insertedSupplies && insertedSupplies.length > 0) {
             // If returning works, use the returned IDs
             supplyIds.push(...insertedSupplies.map(s => s.id));
             console.log(`Got ${supplyIds.length} supply IDs from bulkInsert return`);
           } else {
             // Fallback: query the supply IDs for each item in the batch individually
             console.log('BulkInsert did not return IDs, using robust fallback query');
             const fallbackSupplyIds = [];
             for (const supplyItem of batch) {
               const foundSupply = await sequelize.models.Supply.findOne({
                 where: {
                   vendor_id: supplyItem.vendor_id,
                   product_id: supplyItem.product_id,
                   combination_id: supplyItem.combination_id,
                 },
                 order: [['id', 'DESC']], // Assuming the latest one inserted in this batch is the one
                 attributes: ['id'],
                 transaction
               });
               if (foundSupply) {
                 fallbackSupplyIds.push(foundSupply.id);
               } else {
                 console.error(`Fallback failed: Could not find supply for vendor ${supplyItem.vendor_id}, product ${supplyItem.product_id}, combination ${supplyItem.combination_id}`);
                 fallbackSupplyIds.push(null); // Push null if not found
               }
             }
             supplyIds.push(...fallbackSupplyIds);
             console.log(`Got ${supplyIds.length} supply IDs from fallback query`);
           }

          // Update combination stock directly (new system) and create inventory records as logs
          await Promise.all(batch.map(async (supply, index) => {
            const combinationId = supply.combination_id;
            const productId = supply.product_id;
            const quantity = supply.quantity_supplied;
            const supplyId = supplyIds[index]; // Use the correctly retrieved supplyId

            console.log(`Processing supply for combination ${combinationId}, product ${productId}, quantity ${quantity}`);

            // Find or create the product-level Inventory record (now just a log/status holder)
            // No 'stock' field on Inventory anymore, so only update restocked_at and supply_id
            const [inventoryRecord, created] = await sequelize.models.Inventory.findOrCreate({
              where: { product_id: productId },
              defaults: {
                supply_id: supplyId,
                restocked_at: supply.supply_date,
                created_at: new Date(),
                updated_at: new Date()
              },
              transaction
            });

            if (!created) {
              await inventoryRecord.update({
                supply_id: supplyId,
                restocked_at: supply.supply_date,
                updated_at: new Date()
              }, { transaction });
            }

            // Update the combination stock (this is the single source of truth)
            const combination = await VariantCombination.findByPk(combinationId, { transaction });
            if (combination) {
              const previousCombinationStock = combination.stock || 0;
              const newCombinationStock = previousCombinationStock + quantity;

              await VariantCombination.update(
                { stock: newCombinationStock },
                { where: { id: combinationId }, transaction }
              );

              console.log(`Updated combination ${combinationId} stock from ${previousCombinationStock} to ${newCombinationStock}`);

              // Create Inventory History for this combination update
              await sequelize.models.InventoryHistory.create({
                inventory_id: inventoryRecord.id, // Link to the product-level inventory record (log)
                change_amount: quantity,
                change_type: 'supply',
                previous_stock: previousCombinationStock, // Previous stock of the combination
                new_stock: newCombinationStock, // New stock of the combination
                adjusted_by: adminUser.id,
                changed_at: new Date(),
                created_at: new Date(),
                // Include combination_id in history for better tracking
                combination_id: combinationId
              }, { transaction });

            } else {
              console.error(`Combination ${combinationId} not found for supply update!`);
            }
          }));

          progress.update(batch.length);
        }

        console.log('\nProcessing completed successfully!');
      }

      await transaction.commit();
      console.log(`Successfully seeded ${supplies.length} supply records and updated inventory.`);

    } catch (error) {
      await transaction.rollback();
      console.error('Error seeding supplies:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // Delete all records from tables in reverse order of dependency
    await queryInterface.bulkDelete('inventory_history', null, {});
    // Note: VariantCombination records are deleted via product cascade or manually cleared
    // We should ensure VariantCombination records are cleared before products for clean state if products do not cascade delete combinations
    // For now, assuming products table cascade deletes variant_combinations.
    // If not, add a line here: await queryInterface.bulkDelete('variant_combinations', null, {});

    await queryInterface.bulkDelete('inventory', null, {});
    await queryInterface.bulkDelete('supply', null, {});
    await queryInterface.bulkDelete('vendor_product_tags', null, {});
  }
};
