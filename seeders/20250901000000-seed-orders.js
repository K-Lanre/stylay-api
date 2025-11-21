'use strict';
const { faker } = require('@faker-js/faker/locale/en_US');
const { generateOrderNumber } = require('../utils/orderUtils');

// Configure faker
const {
  number: { int: randomNumber },
  helpers: { arrayElement, shuffle },
  commerce: { price },
  date: { past, between, recent },
  lorem: { sentence },
  string: { uuid }
} = faker;



module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Fetch existing data
      console.log("Fetching existing data...");

      const customers = await queryInterface.sequelize.query(
        'SELECT u.id FROM users u INNER JOIN user_roles ur ON u.id = ur.user_id INNER JOIN roles r ON ur.role_id = r.id WHERE r.name = "customer"',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      if (customers.length === 0) {
        throw new Error("No customers found. Please seed customers first.");
      }

      const addresses = await queryInterface.sequelize.query(
        "SELECT id, user_id FROM addresses",
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      if (addresses.length === 0) {
        throw new Error("No addresses found. Please seed addresses first.");
      }

      const products = await queryInterface.sequelize.query(
        'SELECT id, price, discounted_price, vendor_id FROM products WHERE status = "active"',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      if (products.length === 0) {
        throw new Error(
          "No active products found. Please seed products first."
        );
      }

      const variantCombinations = await queryInterface.sequelize.query(
        `SELECT
          vc.id,
          vc.product_id,
          vc.combination_name,
          vc.stock,
          vc.price_modifier,
          vc.sku_suffix,
          p.price as base_price,
          p.discounted_price,
          p.vendor_id
        FROM variant_combinations vc
        JOIN products p ON vc.product_id = p.id
        WHERE vc.stock > 0 AND vc.is_active = true AND p.status = 'active'`,
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      console.log(
        `Found ${customers.length} customers, ${addresses.length} addresses, ${products.length} products, ${variantCombinations.length} variant combinations`
      );

      const batchSize = 500;
      const totalOrders = 5000;
      let totalOrderItems = 0;
      let totalPaymentTransactions = 0;
      let totalInventoryHistory = 0;
      let totalNotifications = 0;

      // Status distribution: 10% pending, 10% processing, 10% shipped, 70% delivered
      const statusWeights = [
        { status: "pending", paymentStatus: "pending", weight: 0.1 },
        { status: "processing", paymentStatus: "pending", weight: 0.1 },
        { status: "shipped", paymentStatus: "pending", weight: 0.1 },
        { status: "delivered", paymentStatus: "paid", weight: 0.7 },
      ];

      const getRandomStatus = () => {
        const random = Math.random();
        let cumulativeWeight = 0;
        for (const statusWeight of statusWeights) {
          cumulativeWeight += statusWeight.weight;
          if (random <= cumulativeWeight) {
            return statusWeight;
          }
        }
        return statusWeights[statusWeights.length - 1]; // fallback to delivered
      };

      for (
        let batchStart = 0;
        batchStart < totalOrders;
        batchStart += batchSize
      ) {
        const batchEnd = Math.min(batchStart + batchSize, totalOrders);
        const batchOrders = [];

        console.log(
          `Processing batch ${Math.floor(batchStart / batchSize) + 1}: orders ${
            batchStart + 1
          } to ${batchEnd}`
        );

        for (let i = batchStart; i < batchEnd; i++) {
          // Select random customer and their address
          const customer = arrayElement(customers);
          const customerAddresses = addresses.filter(
            (addr) => addr.user_id === customer.id
          );
          const address =
            customerAddresses.length > 0
              ? arrayElement(customerAddresses)
              : arrayElement(addresses);

          // Generate order date (past 365 days)
          const orderDate = past(365);
          const statusInfo = getRandomStatus();

          // Generate order items (1-5 items)
          const itemCount = randomNumber({ min: 1, max: 5 });
          const orderItems = [];
          let subtotal = 0;

          for (let j = 0; j < itemCount; j++) {
            const product = arrayElement(products);
            const quantity = randomNumber({ min: 1, max: 3 });

            // Try to find combinations for this product
            const productCombinations = variantCombinations.filter(
              (vc) => vc.product_id === product.id && vc.stock >= quantity
            );
            const combination =
              productCombinations.length > 0
                ? arrayElement(productCombinations)
                : null;

            // Get variant details for selected_variants JSON
            let selectedVariants = null;
            if (combination) {
              // Fetch variant details for this combination
              const combinationVariants = await queryInterface.sequelize.query(
                `SELECT pv.id, pv.name, pv.value
                 FROM product_variants pv
                 JOIN variant_combination_variants vcv ON pv.id = vcv.variant_id
                 WHERE vcv.combination_id = ?`,
                {
                  replacements: [combination.id],
                  type: queryInterface.sequelize.QueryTypes.SELECT,
                  transaction,
                }
              );
              selectedVariants = combinationVariants;
            }

            const itemPrice = product.discounted_price || product.price;
            const finalPrice = combination
              ? parseFloat(itemPrice) + parseFloat(combination.price_modifier)
              : parseFloat(itemPrice);
            const itemSubtotal = finalPrice * quantity;

            orderItems.push({
              product_id: product.id,
              vendor_id: product.vendor_id,
              combination_id: combination ? combination.id : null,
              variant_id: null, // Keep for backward compatibility, but not used with combinations
              quantity,
              price: finalPrice.toFixed(2),
              sub_total: itemSubtotal.toFixed(2),
              selected_variants: selectedVariants
                ? JSON.stringify(selectedVariants)
                : null,
            });

            subtotal += itemSubtotal;
          }

          // Calculate shipping and tax
          const shipping = randomNumber({ min: 1000, max: 5000 });
          const taxRate = randomNumber({ min: 5, max: 10 }) / 100;
          const taxAmount = subtotal * taxRate;
          const totalAmount = subtotal + shipping + taxAmount;

          // Create order
          const order = {
            user_id: customer.id,
            order_date: orderDate,
            total_amount: totalAmount.toFixed(2),
            payment_status: statusInfo.paymentStatus,
            payment_method:
              statusInfo.paymentStatus === "paid"
                ? arrayElement(["card", "bank_transfer", "wallet"])
                : null,
            payment_reference:
              statusInfo.paymentStatus === "paid" ? uuid() : null,
            paid_at:
              statusInfo.paymentStatus === "paid"
                ? between({ from: orderDate, to: new Date() })
                : null,
            order_status: statusInfo.status,
          };

          batchOrders.push({
            order,
            orderItems,
            subtotal,
            shipping,
            taxAmount,
            addressId: address.id,
          });
        }

        // Get the next order ID to generate order numbers
        const lastOrderResult = await queryInterface.sequelize.query(
          "SELECT id FROM orders ORDER BY id DESC LIMIT 1",
          { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
        );
        const nextOrderId =
          lastOrderResult.length > 0 ? lastOrderResult[0].id + 1 : 1;

        // Generate order numbers and add to orders
        const ordersToInsert = batchOrders.map((b, index) => {
          const orderId = nextOrderId + index;
          const orderNumber = generateOrderNumber(orderId);
          // Store the order number for later use in notifications
          b.orderNumber = orderNumber;
          return {
            ...b.order,
            order_number: orderNumber,
          };
        });

        // Batch insert orders with order numbers
        await queryInterface.bulkInsert("orders", ordersToInsert, {
          transaction,
        });

        // Get the actual order IDs that were inserted
        const insertedOrderIds = await queryInterface.sequelize.query(
          `SELECT id FROM orders WHERE id >= ${nextOrderId} ORDER BY id ASC LIMIT ${batchOrders.length}`,
          { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
        );

        // Process each order in the batch
        for (let i = 0; i < batchOrders.length; i++) {
          const orderData = batchOrders[i];
          const orderId = insertedOrderIds[i].id;

          // Update order items with order_id
          const orderItemsToInsert = orderData.orderItems.map((item) => ({
            ...item,
            order_id: orderId,
            created_at: new Date(),
            updated_at: new Date(),
          }));

          await queryInterface.bulkInsert("order_items", orderItemsToInsert, {
            transaction,
          });

          // Create order details
          await queryInterface.bulkInsert(
            "order_details",
            [
              {
                order_id: orderId,
                address_id: orderData.addressId,
                shipping_cost: orderData.shipping.toFixed(2),
                tax_amount: orderData.taxAmount.toFixed(2),
                note: Math.random() > 0.8 ? sentence() : null,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
            { transaction }
          );

          // Create payment transaction if paid
          if (orderData.order.payment_status === "paid") {
            await queryInterface.bulkInsert(
              "payment_transactions",
              [
                {
                  user_id: orderData.order.user_id,
                  order_id: orderId,
                  type: "payment",
                  amount: orderData.order.total_amount,
                  status: "completed",
                  transaction_id: orderData.order.payment_reference,
                  description: `Payment for order #${orderId}`,
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              ],
              { transaction }
            );
            totalPaymentTransactions++;
          }

          // Update combination stock and create history
          for (const item of orderData.orderItems) {
            if (item.combination_id) {
              // Find the combination in our fetched data
              const combination = variantCombinations.find(
                (vc) => vc.id === item.combination_id
              );
              if (combination && combination.stock >= item.quantity) {
                const quantity = parseInt(item.quantity);
                const previousStock = combination.stock;
                const newStock = previousStock - quantity;

                // Update combination stock
                await queryInterface.bulkUpdate(
                  "variant_combinations",
                  { stock: newStock, updated_at: new Date() },
                  { id: combination.id },
                  { transaction }
                );

                // Resolve or create inventory record for the product to satisfy FK constraint
                let inventoryIdForProduct = null;
                const existingInventory = await queryInterface.sequelize.query(
                  'SELECT id FROM inventory WHERE product_id = ? LIMIT 1',
                  {
                    replacements: [item.product_id],
                    type: queryInterface.sequelize.QueryTypes.SELECT,
                    transaction,
                  }
                );

                if (existingInventory && existingInventory.length > 0) {
                  inventoryIdForProduct = existingInventory[0].id;
                } else {
                  // Create inventory record if missing
                  await queryInterface.sequelize.query(
                    'INSERT INTO inventory (product_id, created_at, updated_at) VALUES (?, NOW(), NOW())',
                    { replacements: [item.product_id], transaction }
                  );
                  const createdInventory = await queryInterface.sequelize.query(
                    'SELECT id FROM inventory WHERE product_id = ? LIMIT 1',
                    {
                      replacements: [item.product_id],
                      type: queryInterface.sequelize.QueryTypes.SELECT,
                      transaction,
                    }
                  );
                  inventoryIdForProduct = createdInventory[0].id;
                }

                // Create inventory history for combination with inventory_id
                await queryInterface.bulkInsert(
                  "inventory_history",
                  [
                    {
                      inventory_id: inventoryIdForProduct,
                      combination_id: combination.id,
                      change_amount: -quantity,
                      change_type: 'sale',
                      previous_stock: previousStock,
                      new_stock: newStock,
                      note: `Order #${orderId} - Sold ${quantity} units of combination ${combination.combination_name}`,
                      adjusted_by: orderData.order.user_id,
                      created_at: new Date(),
                      updated_at: new Date(),
                    },
                  ],
                  { transaction }
                );

                totalInventoryHistory++;

                // Update product sold_units
                await queryInterface.sequelize.query(
                  "UPDATE products SET sold_units = sold_units + ? WHERE id = ?",
                  { replacements: [quantity, item.product_id], transaction }
                );

                console.log(
                  `Updated combination ${combination.id} (${combination.combination_name}): ${previousStock} -> ${newStock}`
                );
              } else {
                console.warn(
                  `Insufficient stock for combination ${item.combination_id}, skipping inventory update`
                );
              }
            } else {
              // No combination available - this shouldn't happen with the new system
              console.warn(
                `No combination found for order item ${item.product_id}, skipping inventory update`
              );
            }
          }

          // Create notifications
          const notifications = [];

          // Order receipt notification
          notifications.push({
            user_id: orderData.order.user_id,
            type: "order_process",
            message: `Your order #${orderId} has been received and is being processed.`,
            is_read: Math.random() > 0.5,
            created_at: new Date(),
          });

          // Payment confirmation if paid
          if (orderData.order.payment_status === "paid") {
            notifications.push({
              user_id: orderData.order.user_id,
              type: "success",
              message: `Payment confirmed for order #${orderId}. Amount: ₦${orderData.order.total_amount}`,
              is_read: Math.random() > 0.7,
              created_at: new Date(),
            });
          }

          if (notifications.length > 0) {
            await queryInterface.bulkInsert("notifications", notifications, {
              transaction,
            });

            // Get notification IDs and create notification items
            const lastNotification = await queryInterface.sequelize.query(
              "SELECT id FROM notifications ORDER BY id DESC LIMIT 1",
              { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
            );
            const firstNotificationId =
              lastNotification[0].id - notifications.length + 1;

            const notificationItems = [];
            for (let n = 0; n < notifications.length; n++) {
              const notificationId = firstNotificationId + n;
              notificationItems.push({
                notification_id: notificationId,
                item_details: `Order #${orderId} - ${orderData.orderItems.length} item(s)`,
                created_at: new Date(),
              });
            }

            await queryInterface.bulkInsert(
              "notification_items",
              notificationItems,
              { transaction }
            );
            totalNotifications += notifications.length;
          }

          totalOrderItems += orderData.orderItems.length;
        }
      }

      await transaction.commit();

      console.log(`Seeded ${totalOrders} orders with:`);
      console.log(`- ${totalOrderItems} order items`);
      console.log(`- ${totalPaymentTransactions} payment transactions`);
      console.log(`- ${totalInventoryHistory} inventory history entries`);
      console.log(`- ${totalNotifications} notifications`);
    } catch (error) {
      await transaction.rollback();
      console.error("Error seeding orders:", error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Delete in reverse order to maintain referential integrity

      // Delete notification items
      await queryInterface.bulkDelete("notification_items", null, {
        transaction,
      });

      // Delete notifications
      await queryInterface.bulkDelete("notifications", null, { transaction });

      // Delete inventory history (this seeder's entries)
      await queryInterface.sequelize.query(
        'DELETE FROM inventory_history WHERE note LIKE "Order #% - Sold%"',
        { transaction }
      );

      // Restore combination stock levels (approximate restoration)
      await queryInterface.sequelize.query(
        `UPDATE variant_combinations vc
         SET vc.stock = vc.stock + COALESCE((
           SELECT SUM(ABS(ih.change_amount))
           FROM inventory_history ih
           WHERE ih.combination_id = vc.id
           AND ih.note LIKE "Order #% - Sold%units of combination%"
         ), 0)
         WHERE vc.id IN (
           SELECT DISTINCT combination_id
           FROM inventory_history
           WHERE note LIKE "Order #% - Sold%units of combination%"npx sequelize-cli db:seed --seed 20250901000000-seed-orders.jsnpx sequelize-cli db:seed --seed 20250901000000-seed-orders.js
         )`,
        { transaction }
      );

      // Delete payment transactions for orders
      await queryInterface.sequelize.query(
        "DELETE FROM payment_transactions WHERE order_id IS NOT NULL",
        { transaction }
      );

      // Delete order details
      await queryInterface.bulkDelete("order_details", null, { transaction });

      // Delete order items
      await queryInterface.bulkDelete("order_items", null, { transaction });

      // Delete orders
      await queryInterface.bulkDelete("orders", null, { transaction });

      // Reset sold_units for all products (this is approximate since we can't track exact amounts)
      await queryInterface.sequelize.query(
        "UPDATE products SET sold_units = 0",
        { transaction }
      );

      await transaction.commit();
      console.log("Cleaned up all seeded order data");
    } catch (error) {
      await transaction.rollback();
      console.error("Error cleaning up order data:", error);
      throw error;
    }
  },
};
