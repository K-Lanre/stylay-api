// utils/cartOrderUtils.js
const { Cart, CartItem, Product, ProductVariant, VariantCombination, Vendor } = require("../models");
const AppError = require("./appError");

/**
 * Get comprehensive cart summary with all associations needed for checkout
 * @param {number|null} userId - User ID for authenticated users
 * @param {string|null} sessionId - Session ID for guest users
 * @param {Object} transaction - Sequelize transaction object (optional)
 * @returns {Object} Comprehensive cart summary with all associations
 */
async function getComprehensiveCartSummary(userId, sessionId, transaction = null) {
  let cart;
  
  // Find cart based on user authentication status
  if (userId) {
    cart = await Cart.findOne({
      where: { user_id: userId },
      include: [
        {
          model: CartItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: [
                "id",
                "vendor_id",
                "name",
                "slug",
                "thumbnail",
                "price",
                "discounted_price",
                "status",
              ],
              include: [
                {
                  model: Vendor,
                  as: "vendor",
                  attributes: ["id", "user_id", "status"],
                  include: [
                    {
                      model: require("../models").Store,
                      as: "store",
                      attributes: ["id", "business_name", "slug"],
                    },
                  ],
                },
                {
                  model: ProductVariant,
                  as: "variants",
                  attributes: ["id", "name", "value", "variant_type_id"],
                  required: false,
                },
                {
                  model: VariantCombination,
                  as: "combinations",
                  attributes: ["id", "combination_name", "stock", "price_modifier", "is_active"],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      transaction,
    });
  } else if (sessionId) {
    cart = await Cart.findOne({
      where: { session_id: sessionId },
      include: [
        {
          model: CartItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: [
                "id",
                "vendor_id",
                "name",
                "slug",
                "thumbnail",
                "price",
                "discounted_price",
                "status",
              ],
              include: [
                {
                  model: Vendor,
                  as: "vendor",
                  attributes: ["id", "user_id", "status"],
                  include: [
                    {
                      model: require("../models").Store,
                      as: "store",
                      attributes: ["id", "business_name", "slug"],
                    },
                  ],
                },
                {
                  model: ProductVariant,
                  as: "variants",
                  attributes: ["id", "name", "value", "variant_type_id"],
                  required: false,
                },
                {
                  model: VariantCombination,
                  as: "combinations",
                  attributes: ["id", "combination_name", "stock", "price_modifier", "is_active"],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      transaction,
    });
  }
  
  if (!cart) {
    return null;
  }
  
  // Validate cart items and check stock availability
  const validatedItems = [];
  const unavailableItems = [];
  const stockIssues = [];
  
  for (const item of cart.items || []) {
    const product = item.product;
    
    // Check if product is active
    if (!product || product.status !== "active") {
      unavailableItems.push({
        itemId: item.id,
        productId: item.product_id,
        productName: product?.name || "Unknown Product",
        reason: "Product is no longer available",
      });
      continue;
    }
    
    // Check vendor status
    if (!product.vendor || product.vendor.status !== "approved") {
      unavailableItems.push({
        itemId: item.id,
        productId: item.product_id,
        productName: product.name,
        reason: "Vendor is not active",
      });
      continue;
    }
    
    // Find matching variant combination if variants are selected
    let combinationId = null;
    let availableStock = null;
    let priceModifier = 0;
    
    if (item.selected_variants && item.selected_variants.length > 0) {
      // Sort selected variant IDs to match against combinations
      const selectedVariantIds = item.selected_variants
        .map(v => v.id)
        .sort((a, b) => a - b);
      
      // Find matching combination
      for (const combination of product.combinations || []) {
        // Get variant IDs for this combination
        const combVariants = await require("../models").VariantCombinationVariant.findAll({
          where: { combination_id: combination.id },
          attributes: ["variant_id"],
          raw: true,
          transaction,
        });
        
        const combVariantIds = combVariants
          .map(v => v.variant_id)
          .sort((a, b) => a - b);
        
        // Check if variant IDs match
        if (JSON.stringify(selectedVariantIds) === JSON.stringify(combVariantIds)) {
          combinationId = combination.id;
          availableStock = combination.stock;
          priceModifier = parseFloat(combination.price_modifier || 0);
          
          // Check if combination is active
          if (!combination.is_active) {
            unavailableItems.push({
              itemId: item.id,
              productId: item.product_id,
              productName: product.name,
              variantCombination: combination.combination_name,
              reason: "This variant combination is no longer available",
            });
            continue;
          }
          
          break;
        }
      }
      
      // If no matching combination found
      if (!combinationId) {
        unavailableItems.push({
          itemId: item.id,
          productId: item.product_id,
          productName: product.name,
          reason: "Selected variant combination is not available",
        });
        continue;
      }
    } else {
      // No variants selected - check product inventory
      const inventory = await product.getInventory({ transaction });
      availableStock = inventory?.stock ?? null;
    }
    
    // Check stock availability
    if (availableStock !== null && item.quantity > availableStock) {
      stockIssues.push({
        itemId: item.id,
        productId: item.product_id,
        productName: product.name,
        requestedQuantity: item.quantity,
        availableStock: availableStock,
      });
      continue;
    }
    
    // Calculate item price with variant modifiers
    const basePrice = parseFloat(product.discounted_price || product.price);
    const variantAdditionalPrice = item.selected_variants
      ? item.selected_variants.reduce((sum, v) => sum + (parseFloat(v.additional_price) || 0), 0)
      : 0;
    const itemPrice = basePrice + variantAdditionalPrice + priceModifier;
    
    validatedItems.push({
      cartItemId: item.id,
      productId: item.product_id,
      vendorId: product.vendor_id,
      productName: product.name,
      thumbnail: product.thumbnail,
      quantity: item.quantity,
      basePrice: basePrice,
      variantAdditionalPrice: variantAdditionalPrice,
      priceModifier: priceModifier,
      itemPrice: itemPrice,
      totalPrice: itemPrice * item.quantity,
      selected_variants: item.selected_variants || [],
      combinationId: combinationId,
      vendor: {
        id: product.vendor.id,
        businessName: product.vendor.store?.business_name || "Unknown Vendor",
        slug: product.vendor.store?.slug,
      },
    });
  }
  
  // Calculate totals
  const subtotal = validatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingCost = 0; // TODO: Calculate based on address/location
  const taxAmount = 0; // TODO: Calculate based on location and tax rules
  const total = subtotal + shippingCost + taxAmount;
  
  return {
    cartId: cart.id,
    totalItems: validatedItems.length,
    subtotal: parseFloat(subtotal.toFixed(2)),
    shippingCost: parseFloat(shippingCost.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    items: validatedItems,
    unavailableItems,
    stockIssues,
    hasIssues: unavailableItems.length > 0 || stockIssues.length > 0,
  };
}

/**
 * Convert cart data to order creation format
 * @param {Object} cartSummary - Cart summary from getComprehensiveCartSummary
 * @param {number} addressId - Shipping address ID
 * @param {string} notes - Order notes (optional)
 * @param {string} paymentMethod - Payment method (default: 'paystack')
 * @returns {Object} Order data in the format expected by createOrder
 * @throws {AppError} If cart has issues or is empty
 */
function convertCartToOrderData(cartSummary, addressId, notes = "", paymentMethod = "paystack") {
  // Validate cart summary
  if (!cartSummary) {
    throw new AppError("Cart is empty", 400);
  }
  
  if (cartSummary.hasIssues) {
    const errorDetails = {
      unavailableItems: cartSummary.unavailableItems,
      stockIssues: cartSummary.stockIssues,
    };
    throw new AppError(
      "Cart has issues that must be resolved before checkout",
      400,
      errorDetails
    );
  }
  
  if (cartSummary.items.length === 0) {
    throw new AppError("Cart is empty", 400);
  }
  
  // Validate address ID
  if (!addressId) {
    throw new AppError("Shipping address is required", 400);
  }
  
  // Convert cart items to order items format
  const orderItems = cartSummary.items.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    variantId: null, // Deprecated, kept for backward compatibility
    selected_variants: item.selected_variants.length > 0 ? item.selected_variants : null,
    combinationId: item.combinationId,
    combination_id: item.combinationId, // Alternative naming
  }));
  
  // Return order data in the exact format expected by createOrder controller
  return {
    addressId: addressId,
    items: orderItems,
    shippingCost: cartSummary.shippingCost,
    taxAmount: cartSummary.taxAmount,
    notes: notes || "",
    paymentMethod: paymentMethod,
  };
}

/**
 * Validate cart before checkout
 * @param {number|null} userId - User ID for authenticated users
 * @param {string|null} sessionId - Session ID for guest users
 * @param {Object} transaction - Sequelize transaction object (optional)
 * @returns {Object} Validation result with cart summary and any issues
 */
async function validateCartForCheckout(userId, sessionId, transaction = null) {
  const cartSummary = await getComprehensiveCartSummary(userId, sessionId, transaction);
  
  if (!cartSummary) {
    return {
      valid: false,
      error: "Cart is empty",
      cartSummary: null,
    };
  }
  
  if (cartSummary.hasIssues) {
    return {
      valid: false,
      error: "Cart has issues that must be resolved",
      cartSummary: cartSummary,
      issues: {
        unavailableItems: cartSummary.unavailableItems,
        stockIssues: cartSummary.stockIssues,
      },
    };
  }
  
  if (cartSummary.items.length === 0) {
    return {
      valid: false,
      error: "Cart is empty",
      cartSummary: cartSummary,
    };
  }
  
  return {
    valid: true,
    cartSummary: cartSummary,
  };
}

/**
 * Clear cart after successful order creation
 * @param {number|null} userId - User ID for authenticated users
 * @param {string|null} sessionId - Session ID for guest users
 * @param {Object} transaction - Sequelize transaction object
 */
async function clearCartAfterOrder(userId, sessionId, transaction) {
  let cart;
  
  if (userId) {
    cart = await Cart.findOne({
      where: { user_id: userId },
      transaction,
    });
  } else if (sessionId) {
    cart = await Cart.findOne({
      where: { session_id: sessionId },
      transaction,
    });
  }
  
  if (!cart) {
    return;
  }
  
  // Delete all cart items
  await CartItem.destroy({
    where: { cart_id: cart.id },
    transaction,
  });
  
  // Reset cart totals
  await cart.update(
    {
      total_items: 0,
      total_amount: 0.0,
    },
    { transaction }
  );
}

module.exports = {
  getComprehensiveCartSummary,
  convertCartToOrderData,
  validateCartForCheckout,
  clearCartAfterOrder,
};
