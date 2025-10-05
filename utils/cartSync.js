const { Cart, CartItem, Product, ProductVariant } = require("../models");
const logger = require("./logger");

/**
 * Sync local cart items with server cart for authenticated user
 * Merges local Redux cart items into authenticated user's server cart.
 * Handles conflicts by combining quantities for same products/variants and validates stock.
 * Uses database transactions for data consistency.
 *
 * @param {number} userId - Authenticated user ID
 * @param {Array} localCartItems - Array of local cart items to sync
 * @param {number} localCartItems[].productId - Product ID
 * @param {number} localCartItems[].quantity - Quantity
 * @param {number} localCartItems[].price - Base product price
 * @param {Array} [localCartItems[].selected_variants] - Array of variant objects
 * @returns {Promise<Object>} Sync report with operation results
 * @throws {Error} When sync operation fails
 */
const syncUserCart = async (userId, localCartItems) => {
  const transaction = await Cart.sequelize.transaction();

  try {
    // Initialize sync report
    const syncReport = {
      successful_merges: [],
      new_items_added: [],
      quantity_adjusted: [],
      failed_items: []
    };

    // Get or create user's cart
    let [cart] = await Cart.findOrCreate({
      where: { user_id: userId },
      defaults: {
        total_items: 0,
        total_amount: 0.0,
      },
      transaction,
    });

    // Lock the cart row to prevent concurrent updates
    await cart.reload({ lock: true, transaction });

    // Process each local cart item
    for (const localItem of localCartItems) {
      try {
        const { productId, quantity, price, selected_variants = [] } = localItem;

        // Convert productId to number to ensure proper database matching
        const numericProductId = Number(productId);
        if (isNaN(numericProductId)) {
          syncReport.failed_items.push({
            productId,
            reason: "Invalid product ID format"
          });
          continue;
        }

        // Fetch product with variants
        const product = await Product.findByPk(numericProductId, {
          include: [
            {
              model: ProductVariant,
              as: "variants",
              required: false,
            },
          ],
          transaction,
        });

        if (!product || product.status !== "active") {
          syncReport.failed_items.push({
            productId,
            reason: "Product not found or not available"
          });
          continue;
        }
        // Convert variant IDs to numbers and sort for consistent comparison
        const processedVariants = selected_variants.map(variant => ({
          ...variant,
          id: Number(variant.id)
        })).sort((a, b) => a.id - b.id);

        logger.info(`Syncing cart item - productId: ${numericProductId}, variants: ${JSON.stringify(processedVariants)}`);

        // Sort selected variants for consistent comparison
        const sortedSelectedVariants = [...selected_variants].sort(
          (a, b) => a.id - b.id
        );

        // Find existing cart item with same product and variants
        const existingItem = await CartItem.findOne({
          where: {
            cart_id: cart.id,
            product_id: numericProductId,
            selected_variants: processedVariants.length > 0 ? processedVariants : null,
          },
          transaction,
        });
        logger.info(`Existing item found: ${existingItem ? existingItem.id : 'none'} for product ${numericProductId}`);

        // Check stock availability
        let availableStock = null;
        if (processedVariants.length > 0) {
          // Check variant stock
          const variantMap = new Map(
            product.variants.map((v) => [Number(v.id), v])
          );
          let hasLowStock = false;
          for (const sel of processedVariants) {
            const variant = variantMap.get(Number(sel.id));
            if (variant && variant.stock !== null) {
              availableStock = Math.min(availableStock ?? variant.stock, variant.stock);
            }
          }
        } else {
          // Check product stock
          const inventory = await product.getInventory({ transaction });
          availableStock = inventory?.stock ?? null;
        }

        const requestedQuantity = existingItem ? existingItem.quantity + quantity : quantity;

        if (availableStock !== null && requestedQuantity > availableStock) {
          // Adjust quantity to maximum available
          const adjustedQuantity = availableStock;

          if (existingItem) {
            // Update existing item with adjusted quantity
            await existingItem.update(
              { quantity: adjustedQuantity },
              { transaction }
            );
            await existingItem.updateTotalPrice(transaction);

            syncReport.successful_merges.push({
              productId,
              oldQuantity: existingItem.quantity,
              newQuantity: adjustedQuantity,
            });
          } else {
            // Create new item with adjusted quantity
            const newItem = await CartItem.create({
              cart_id: cart.id,
              product_id: numericProductId,
              selected_variants: processedVariants.length > 0 ? processedVariants : null,
              quantity: adjustedQuantity,
              price: price,
              total_price: adjustedQuantity * price,
            }, { transaction });

            syncReport.new_items_added.push({
              productId,
              quantity: adjustedQuantity,
            });
          }

          syncReport.quantity_adjusted.push({
            productId,
            variantIds: processedVariants.map(v => v.id),
            requestedQuantity,
            adjustedQuantity,
            reason: "Insufficient stock"
          });
        } else {
          // Sufficient stock available
          if (existingItem) {
            // Update existing item quantity
            await existingItem.update(
              { quantity: requestedQuantity },
              { transaction }
            );
            await existingItem.updateTotalPrice(transaction);

            syncReport.successful_merges.push({
              productId,
              oldQuantity: existingItem.quantity,
              newQuantity: requestedQuantity,
            });
          } else {
            // Create new cart item
            const totalVariantPrice = processedVariants.reduce(
              (sum, v) => sum + (v.additional_price || 0),
              0
            );
            const totalPrice = quantity * (price + totalVariantPrice);

            const newItem = await CartItem.create({
              cart_id: cart.id,
              product_id: numericProductId,
              selected_variants: processedVariants.length > 0 ? processedVariants : null,
              quantity: quantity,
              price: price,
              total_price: totalPrice,
            }, { transaction });

            syncReport.new_items_added.push({
              productId,
              quantity,
            });
          }
        }
      } catch (itemError) {
        // Log individual item errors but continue processing other items
        console.error(`Error syncing cart item ${localItem.productId}:`, itemError);
        syncReport.failed_items.push({
          productId: localItem.productId,
          reason: itemError.message || "Unknown error"
        });
      }
    }

    // Update cart totals
    await cart.updateTotals(transaction);

    await transaction.commit();

    return syncReport;
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

module.exports = {
  syncUserCart,
};