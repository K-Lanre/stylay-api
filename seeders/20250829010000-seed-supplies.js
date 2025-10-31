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

          // Process each supply item to update/create inventory and history
          const createdInventoriesForHistory = []; // To store newly created inventory instances for history creation
          const updatedInventoryIdsForHistory = []; // To store IDs of updated inventory for history creation

          for (const [index, supply] of batch.entries()) {
            const supplyId = supplyIds[index];
            const productId = supply.product_id;
            const quantity = supply.quantity_supplied;
            const supplyDate = supply.supply_date;

            let existingInventory = await sequelize.models.Inventory.findOne({
                where: { product_id: productId },
                transaction
            });

            if (existingInventory) {
                // Update existing inventory
                console.log(`Updating inventory for product ${productId} (ID: ${existingInventory.id}) with supply ID ${supplyId}`);
                const previousStock = existingInventory.stock;
                existingInventory.stock += quantity;
                existingInventory.restocked_at = supplyDate;
                existingInventory.updated_at = new Date();
                // If the supply_id is different, we might want to update it, or just ensure it's linked.
                // For simplicity, we'll update it if it's different or if it was null.
                if (existingInventory.supply_id !== supplyId) {
                    existingInventory.supply_id = supplyId;
                }
                await existingInventory.save({ transaction });
                updatedInventoryIdsForHistory.push({ id: existingInventory.id, previousStock: previousStock, newStock: existingInventory.stock });
            } else {
                // Create new inventory record
                console.log(`Creating new inventory for product ${productId} with supply ID ${supplyId}`);
                const newInventory = await sequelize.models.Inventory.create({
                    product_id: productId,
                    supply_id: supplyId,
                    stock: quantity,
                    restocked_at: supplyDate,
                    created_at: new Date(),
                    updated_at: new Date()
                }, { transaction });
                createdInventoriesForHistory.push({ id: newInventory.id, previousStock: 0, newStock: quantity });
            }
          }

          // Create inventory history records based on created/updated inventories
          const inventoryHistoryRecords = [];

          // Add history for newly created inventories
          createdInventoriesForHistory.forEach(item => {
            inventoryHistoryRecords.push({
              inventory_id: item.id,
              change_amount: item.newStock,
              change_type: 'supply',
              previous_stock: item.previousStock,
              new_stock: item.newStock,
              adjusted_by: adminUser.id,
              changed_at: new Date(),
              created_at: new Date()
            });
          });

          // Add history for updated inventories
          updatedInventoryIdsForHistory.forEach(item => {
            inventoryHistoryRecords.push({
              inventory_id: item.id,
              change_amount: item.newStock - item.previousStock, // Amount added
              change_type: 'supply',
              previous_stock: item.previousStock,
              new_stock: item.newStock,
              adjusted_by: adminUser.id,
              changed_at: new Date(),
              created_at: new Date()
            });
          });

          if (inventoryHistoryRecords.length > 0) {
            console.log(`Creating ${inventoryHistoryRecords.length} inventory history records`);
            await sequelize.models.InventoryHistory.bulkCreate(inventoryHistoryRecords, { transaction });
          }

          // Update combination stock directly (new system)
           await Promise.all(batch.map(async (supply, index) => {
             const combinationId = supply.combination_id;
             const quantity = supply.quantity_supplied;
             const supplyId = supplyIds[index]; // Use the correctly retrieved supplyId

             console.log(`Updating stock for combination ${combinationId}, supply ${supplyId}, quantity ${quantity}`);

             // Update the combination stock
             const combination = await VariantCombination.findByPk(combinationId, { transaction });
             if (combination) {
               const currentStock = combination.stock || 0;
               const newStock = currentStock + quantity;

               await VariantCombination.update(
                 { stock: newStock },
                 { where: { id: combinationId }, transaction }
               );

               console.log(`Updated combination ${combinationId} stock from ${currentStock} to ${newStock}`);
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
    await queryInterface.bulkDelete('inventory_history', null, {}); // Clean up history first
    await queryInterface.bulkDelete('inventory', null, {});
    await queryInterface.bulkDelete('supply', null, {});
    await queryInterface.bulkDelete('vendor_product_tags', null, {}); // Clean up associated tags
  }
};
