const {
  Product,
  ProductVariant,
  ProductImage,
  Vendor,
  Category,
  Store,
  Review,
  VariantType,
  VariantCombination,
  sequelize,
  UserProductView,
  User,
} = require("../models");
const AppError = require("../utils/appError");
const { Op } = require("sequelize");
const slugify = require("slugify");
const VariantService = require("./variant.service");
const recentlyViewedService = require("./recently-viewed.service");

/**
 * Unified Product Service
 * Provides centralized business logic for product operations with role-based authorization
 */
class ProductService {
  /**
   * Authorization rules for different operations based on user roles
   */
  static AUTHORIZATION_RULES = {
    updateProduct: {
      vendor: (product, userId) => product.vendor_id === userId,
      admin: () => true, // Admin can update any product
    },
    deleteProduct: {
      vendor: (product, userId) => product.vendor_id === userId,
      admin: () => true, // Admin can delete any product
    },
    getProductAnalytics: {
      vendor: (product, userId) => product.vendor.user_id === userId,
      admin: () => true, // Admin can view any analytics
    },
  };

  /**
   * Validate that a product exists and return it with associations
   * @param {number} productId - Product ID to validate
   * @param {Array} include - Associations to include
   * @returns {Promise<Object>} Product instance
   * @throws {AppError} 404 - When product not found
   */
  static async validateProductExists(productId, include = []) {
    const product = await Product.findByPk(productId, { include });
    if (!product) {
      throw new AppError("Product not found", 404);
    }
    return product;
  }

  /**
   * Validate that a vendor exists and is approved
   * @param {number} vendorId - Vendor ID to validate
   * @param {string} operation - Operation being performed (for error message)
   * @returns {Promise<Object>} Vendor instance
   * @throws {AppError} 404 - When vendor not found
   * @throws {AppError} 403 - When vendor is not approved
   */
  static async validateVendorApproval(vendorId, operation = "perform this action") {
    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }
    if (vendor.status !== "approved") {
      throw new AppError(`Only approved vendors can ${operation}`, 403);
    }
    return vendor;
  }

  /**
   * Validate that a category exists
   * @param {number} categoryId - Category ID to validate
   * @returns {Promise<Object>} Category instance
   * @throws {AppError} 404 - When category not found
   */
  static async validateCategoryExists(categoryId) {
    const category = await Category.findByPk(categoryId);
    if (!category) {
      throw new AppError("Category not found", 404);
    }
    return category;
  }

  /**
   * Generate a unique slug for a product name
   * @param {string} name - Product name
   * @param {number|null} excludeProductId - Product ID to exclude from uniqueness check
   * @returns {Promise<string>} Unique slug
   */
  static async generateUniqueSlug(name, excludeProductId = null) {
    let slug = slugify(name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });

    const whereClause = { slug: { [Op.like]: `${slug}%` } };
    if (excludeProductId) {
      whereClause.id = { [Op.ne]: excludeProductId };
    }

    const slugCount = await Product.count({ where: whereClause });
    if (slugCount > 0) {
      const randomString = Math.random().toString(36).substring(2, 8);
      slug = `${slug}-${randomString}`;
    }

    return slug;
  }

  /**
   * Format product response with consistent structure
   * @param {Object} product - Product instance
   * @returns {Object} Formatted product data
   */
  static formatProductResponse(product) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      discounted_price: product.discounted_price,
      sku: product.sku,
      status: product.status,
      impressions: product.impressions,
      sold_units: product.sold_units,
      created_at: product.created_at,
      updated_at: product.updated_at,
      vendor_id: product.vendor_id,
      category_id: product.category_id,
      Category: product.Category,
      vendor: product.vendor,
      variants: product.variants || [],
      combinations: product.combinations || [],
      images: product.images || [],
    };
  }

  /**
   * Check if user has authorization for a specific operation
   * @param {Object} product - Product instance
   * @param {string} operation - Operation name
   * @param {string} userRole - User role ('vendor' or 'admin')
   * @param {number} userId - User ID
   * @returns {boolean} Authorization status
   */
  static checkAuthorization(product, operation, userRole, userId) {
    const rules = this.AUTHORIZATION_RULES[operation];
    if (!rules || !rules[userRole]) {
      return false;
    }
    return rules[userRole](product, userId);
  }

  /**
   * Enhanced product update method with full payload support, file uploads, and variant management
   * @param {number} productId - Product ID to update
   * @param {Object} updateData - Data to update including images and variants
   * @param {string} userRole - User role ('vendor' or 'admin')
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated product with associations
   */
  static async updateProduct(productId, updateData, userRole, userId) {
    const {
      name,
      description,
      price,
      category_id,
      sku,
      status,
      variants: rawVariants = [],
      images: rawImages = [],
      vendor_id: vendorId
    } = updateData;

    return await sequelize.transaction(async (t) => {
      // Validate product exists with associations
      const product = await this.validateProductExists(productId, [
        { model: Category, attributes: ["id", "name"] },
        {
          model: Vendor,
          attributes: ["id", "user_id", "status"],
          as: "vendor",
          include: {
            model: Store,
            as: "store",
            attributes: ["id", "business_name"],
          },
        },
        {
          model: ProductVariant,
          as: "variants",
          attributes: ["id", "name", "value"],
        },
        { model: ProductImage, as: "images" },
        {
          model: VariantCombination,
          as: "combinations",
          include: [
            {
              model: ProductVariant,
              as: "variants",
              attributes: ["id", "name", "value"],
              through: { attributes: [] },
            },
          ],
        },
      ]);

      // Apply role-based authorization
      if (userRole === "vendor") {
        // For vendors, verify ownership and vendor approval
        const vendor = await this.validateVendorApproval(
          product.vendor_id,
          "update products"
        );

        if (product.vendor_id !== userId) {
          throw new AppError("Not authorized to update this product", 403);
        }

        if (vendor.status !== "approved") {
          throw new AppError("Your vendor account is not approved", 403);
        }
      } else if (userRole === "admin") {
        // For admins, just verify the vendor exists and is approved
        const vendor = await this.validateVendorApproval(
          product.vendor_id,
          "be managed by admins"
        );
      }

      // Validate category if being updated
      if (category_id) {
        await this.validateCategoryExists(category_id);
      }

      // Generate new slug if name is being updated
      let slug = product.slug;
      if (name && name !== product.name) {
        slug = await this.generateUniqueSlug(name, product.id);
      }

      // Prepare update data - exclude stock from product update
      const updateFields = {
        name: name || product.name,
        slug,
        description: description || product.description,
        price: price || product.price,
        category_id: category_id || product.category_id,
        sku: sku || product.sku,
        status: status || product.status,
      };

      // Update the product
      await product.update(updateFields, { transaction: t });

      // Handle variant updates if provided
      if (rawVariants && rawVariants.length > 0) {
        try {
          // Parse variants if it's a string
          let variants = rawVariants;
          if (typeof rawVariants === "string") {
            try {
              variants = JSON.parse(rawVariants);
            } catch (e) {
              throw new AppError("Variants must be a valid JSON array", 400);
            }
          }

          // Validate variant data
          const validation = VariantService.validateVariantData(variants);
          if (!validation.isValid) {
            throw new AppError(
              `Invalid variant data: ${validation.errors.join(", ")}`,
              400
            );
          }

          // Update variants and regenerate combinations
          await this.updateProductVariants(productId, variants, t);
        } catch (variantError) {
          console.error("Variant update error:", variantError);
          throw variantError;
        }
      }

      // Handle image updates if provided
      if (rawImages && rawImages.length > 0) {
        try {
          // Update product images
          await this.updateProductImages(productId, rawImages, t);
        } catch (imageError) {
          console.error("Image update error:", imageError);
          throw imageError;
        }
      }

      // Fetch the updated product with associations
      const updatedProduct = await this.validateProductExists(productId, [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id"],
          as: "vendor",
          include: [
            {
              model: Store,
              as: "store",
              attributes: ["id", "business_name"],
            },
          ],
        },
        {
          model: ProductVariant,
          as: "variants",
          attributes: ["id", "name", "value"],
        },
        { model: ProductImage, as: "images" },
        {
          model: VariantCombination,
          as: "combinations",
          include: [
            {
              model: ProductVariant,
              as: "variants",
              attributes: ["id", "name", "value"],
              through: { attributes: [] },
            },
          ],
        },
      ]);

      return this.formatProductResponse(updatedProduct);
    });
  }

  /**
   * Update product variants and regenerate combinations
   * @param {number} productId - Product ID
   * @param {Array} variants - Array of variant data
   * @param {Object} transaction - Sequelize transaction
   * @returns {Promise<void>}
   */
  static async updateProductVariants(productId, variants, transaction) {
    try {
      console.log(`=== VARIANT UPDATE DIAGNOSTIC ===`);
      console.log(`Product ID: ${productId}`);
      console.log(`Variants to process: ${variants ? variants.length : 0}`);
      
      // First, check for existing supply records that reference variant combinations
      const existingSupplies = await sequelize.models.Supply.count({
        where: { product_id: productId },
        transaction
      });
      console.log(`Existing supply records: ${existingSupplies}`);
      
      if (existingSupplies > 0) {
        console.log(`Found ${existingSupplies} supply records. These must be deleted first.`);
      }

      // Delete existing supply records first (child records)
      await sequelize.models.Supply.destroy({
        where: { product_id: productId },
        transaction
      });
      console.log(`Deleted ${existingSupplies} supply records`);

      // Delete existing inventory history records
      // First, get all inventory records for this product
      const inventoryRecords = await sequelize.models.Inventory.findAll({
        where: { product_id: productId },
        attributes: ['id'],
        transaction
      });
      
      const inventoryIds = inventoryRecords.map(inv => inv.id);
      
      if (inventoryIds.length > 0) {
        await sequelize.models.InventoryHistory.destroy({
          where: { inventory_id: inventoryIds },
          transaction
        });
        console.log(`Deleted inventory history records for ${inventoryIds.length} inventory records`);
      } else {
        console.log(`No inventory records found for product ${productId}`);
      }

      // Now delete variant combinations (parent records)
      await VariantCombination.destroy({
        where: { product_id: productId },
        transaction
      });
      console.log(`Deleted variant combinations`);

      // Delete existing variants
      await ProductVariant.destroy({
        where: { product_id: productId },
        transaction
      });
      console.log(`Deleted product variants`);

      if (!variants || variants.length === 0) {
        console.log(`No variants to create`);
        return;
      }

      // Create new variants and combinations
      const createdVariants = [];
      for (const variantData of variants) {
        let variantType = await VariantType.findOne({
          where: { name: variantData.type.toLowerCase() },
          transaction,
        });

        if (!variantType) {
          variantType = await VariantType.create(
            {
              name: variantData.type.toLowerCase(),
              display_name: variantData.type,
              sort_order: 0,
            },
            { transaction }
          );
        }

        const variant = await ProductVariant.create(
          {
            product_id: productId,
            variant_type_id: variantType.id,
            name: variantData.type,
            value: variantData.value,
            created_at: new Date(),
          },
          { transaction }
        );

        createdVariants.push({
          id: variant.id,
          type: variantData.type,
          value: variantData.value,
        });
      }

      console.log(`Created ${createdVariants.length} new variants`);
      
      // Generate and create combinations
      await VariantService.createCombinationsForProduct(
        productId,
        createdVariants,
        transaction
      );
      console.log(`Created variant combinations`);
      
      console.log(`=== VARIANT UPDATE COMPLETE ===`);
    } catch (error) {
      console.error('Variant update error:', error);
      throw error;
    }
  }

  /**
   * Update product images
   * @param {number} productId - Product ID
   * @param {Array} images - Array of image data
   * @param {Object} transaction - Sequelize transaction
   * @returns {Promise<void>}
   */
  static async updateProductImages(productId, images, transaction) {
    // Delete existing images
    await ProductImage.destroy({
      where: { product_id: productId },
      transaction
    });

    // Add new images if any
    if (images && images.length > 0) {
      await ProductImage.bulkCreate(
        images.map((image, index) => ({
          product_id: productId,
          image_url: image.url || image.image_url, // Support both formats
          is_featured: image.is_featured !== undefined ? image.is_featured : index === 0, // First image is featured by default
        })),
        { transaction }
      );
    }
  }

  /**
   * Unified product deletion method with role-based authorization
   * @param {number} productId - Product ID to delete
   * @param {string} userRole - User role ('vendor' or 'admin')
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Success response
   */
  static async deleteProduct(productId, userRole, userId) {
    return await sequelize.transaction(async (t) => {
      // Validate product exists
      const product = await this.validateProductExists(productId);

      // Apply role-based authorization
      if (userRole === "vendor") {
        if (product.vendor_id !== userId) {
          throw new AppError("Not authorized to delete this product", 403);
        }
      }
      // Admins can delete any product (no additional check needed)

      // Check for existing references before deletion
      console.log(`[Product Deletion Debug] Checking references for product ${productId}`);
      
      // Check order items
      const orderItemsCount = await sequelize.models.OrderItem.count({
        where: { product_id: productId },
        transaction: t
      });
      console.log(`[Product Deletion Debug] Order items referencing product: ${orderItemsCount}`);
      
      // Check cart items
      const cartItemsCount = await sequelize.models.CartItem.count({
        where: { product_id: productId },
        transaction: t
      });
      console.log(`[Product Deletion Debug] Cart items referencing product: ${cartItemsCount}`);
      
      // Check wishlist items
      const wishlistItemsCount = await sequelize.models.WishlistItem.count({
        where: { product_id: productId },
        transaction: t
      });
      console.log(`[Product Deletion Debug] Wishlist items referencing product: ${wishlistItemsCount}`);
      
      // Check reviews
      const reviewsCount = await sequelize.models.Review.count({
        where: { product_id: productId },
        transaction: t
      });
      console.log(`[Product Deletion Debug] Reviews referencing product: ${reviewsCount}`);
      
      // Check inventory
      const inventoryCount = await sequelize.models.Inventory.count({
        where: { product_id: productId },
        transaction: t
      });
      console.log(`[Product Deletion Debug] Inventory records for product: ${inventoryCount}`);
      
      // Check product images
      const imagesCount = await sequelize.models.ProductImage.count({
        where: { product_id: productId },
        transaction: t
      });
      console.log(`[Product Deletion Debug] Product images for product: ${imagesCount}`);
      
      // Check product variants
      const variantsCount = await sequelize.models.ProductVariant.count({
        where: { product_id: productId },
        transaction: t
      });
      console.log(`[Product Deletion Debug] Product variants for product: ${variantsCount}`);
      
      // Check supply records
      const supplyCount = await sequelize.models.Supply.count({
        where: { product_id: productId },
        transaction: t
      });
      console.log(`[Product Deletion Debug] Supply records for product: ${supplyCount}`);

      // Delete related records in proper order to avoid foreign key constraint issues
      console.log(`[Product Deletion Debug] Starting cleanup of related records...`);

      // 1. Delete product variants (CASCADE should handle this, but being explicit)
      if (variantsCount > 0) {
        await sequelize.models.ProductVariant.destroy({
          where: { product_id: productId },
          transaction: t
        });
        console.log(`[Product Deletion Debug] Deleted ${variantsCount} product variants`);
      }

      // 2. Delete product images
      if (imagesCount > 0) {
        await sequelize.models.ProductImage.destroy({
          where: { product_id: productId },
          transaction: t
        });
        console.log(`[Product Deletion Debug] Deleted ${imagesCount} product images`);
      }

      // 3. Delete inventory records
      if (inventoryCount > 0) {
        await sequelize.models.Inventory.destroy({
          where: { product_id: productId },
          transaction: t
        });
        console.log(`[Product Deletion Debug] Deleted ${inventoryCount} inventory records`);
      }

      // 4. Delete supply records
      if (supplyCount > 0) {
        await sequelize.models.Supply.destroy({
          where: { product_id: productId },
          transaction: t
        });
        console.log(`[Product Deletion Debug] Deleted ${supplyCount} supply records`);
      }

      // 5. Delete reviews (these can be deleted as they don't affect order history)
      if (reviewsCount > 0) {
        await sequelize.models.Review.destroy({
          where: { product_id: productId },
          transaction: t
        });
        console.log(`[Product Deletion Debug] Deleted ${reviewsCount} reviews`);
      }

      // 6. Delete wishlist items (product is no longer available)
      if (wishlistItemsCount > 0) {
        await sequelize.models.WishlistItem.destroy({
          where: { product_id: productId },
          transaction: t
        });
        console.log(`[Product Deletion Debug] Deleted ${wishlistItemsCount} wishlist items`);
      }

      // 7. Delete cart items (product is no longer available)
      if (cartItemsCount > 0) {
        await sequelize.models.CartItem.destroy({
          where: { product_id: productId },
          transaction: t
        });
        console.log(`[Product Deletion Debug] Deleted ${cartItemsCount} cart items`);
      }

      // 8. IMPORTANT: Order items should NOT be deleted as they are part of order history
      // Instead, we leave them as references to deleted products for audit trail
      if (orderItemsCount > 0) {
        console.log(`[Product Deletion Debug] WARNING: ${orderItemsCount} order items reference this product. These will remain for order history.`);
      }

      // Delete the product
      await product.destroy({ transaction: t });

      console.log(`[Product Deletion Debug] Product ${productId} deleted successfully`);

      return {
        success: true,
        data: {
          message: "Product deleted successfully",
          cleanup: {
            variants: variantsCount,
            images: imagesCount,
            inventory: inventoryCount,
            supply: supplyCount,
            reviews: reviewsCount,
            wishlist_items: wishlistItemsCount,
            cart_items: cartItemsCount,
            order_items_preserved: orderItemsCount
          }
        },
      };
    });
  }

  /**
   * Unified product analytics method with role-based authorization
   * @param {number} productId - Product ID to get analytics for
   * @param {string} userRole - User role ('vendor' or 'admin')
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Analytics data
   */
  static async getProductAnalytics(productId, userRole, userId) {
    console.log(`=== DIAGNOSTIC: getProductAnalytics called ===`);
    console.log(`Product ID: ${productId}`);
    console.log(`User Role: ${userRole}`);
    console.log(`User ID: ${userId}`);
    
    // Validate product exists with associations
    const product = await this.validateProductExists(productId, [
      { model: Vendor, attributes: ["id", "user_id"], as: "vendor" },
      { model: Category, attributes: ["id", "name"] },
    ]);

    console.log(`Product found: ${product.name} (ID: ${product.id})`);
    console.log(`Product vendor_id: ${product.vendor_id}`);
    console.log(`Product vendor.user_id: ${product.vendor?.user_id}`);

    // Apply role-based authorization
    if (userRole === "vendor") {
      // Check if the product has a vendor and if the vendor's user_id matches the current user
      if (!product.vendor || product.vendor.user_id !== userId) {
        console.log(`AUTHORIZATION FAILED: Product vendor (${product.vendor?.user_id}) !== User ID (${userId})`);
        throw new AppError("Not authorized to view this product's analytics", 403);
      }
      console.log(`AUTHORIZATION PASSED: Vendor access granted`);
    } else {
      console.log(`AUTHORIZATION: Admin access granted`);
    }
    // Admins can view any product analytics (no additional check needed)

    // Get order statistics for this product
    console.log(`=== FETCHING ORDER STATISTICS ===`);
    const orderStats = await sequelize.query(
      `
      SELECT
        COUNT(DISTINCT oi.order_id) as total_orders,
        SUM(oi.quantity) as total_units_sold,
        AVG(oi.price) as average_sale_price,
        SUM(oi.sub_total) as total_revenue,
        MIN(o.order_date) as first_sale_date,
        MAX(o.order_date) as last_sale_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = :productId
      AND o.payment_status = 'paid'
      AND o.order_status IN ('processing', 'shipped', 'delivered')
    `,
      {
        replacements: { productId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`Order stats result:`, orderStats);

    // Get monthly sales data for the last 12 months
    console.log(`=== FETCHING MONTHLY SALES ===`);
    const monthlySales = await sequelize.query(
      `
      SELECT
        DATE_FORMAT(o.order_date, '%Y-%m') as month,
        COUNT(DISTINCT oi.order_id) as orders_count,
        SUM(oi.quantity) as units_sold,
        SUM(oi.sub_total) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = :productId
      AND o.payment_status = 'paid'
      AND o.order_status IN ('processing', 'shipped', 'delivered')
      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
      ORDER BY month DESC
    `,
      {
        replacements: { productId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`Monthly sales result:`, monthlySales);

    // Get review statistics for this product
    console.log(`=== FETCHING REVIEW STATISTICS ===`);
    const reviewStats = await sequelize.query(
      `
      SELECT
        COUNT(r.id) as total_reviews,
        AVG(r.rating) as average_rating,
        COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as positive_reviews,
        COUNT(CASE WHEN r.rating <= 2 THEN 1 END) as negative_reviews,
        COUNT(CASE WHEN r.rating = 3 THEN 1 END) as neutral_reviews
      FROM reviews r
      WHERE r.product_id = :productId
    `,
      {
        replacements: { productId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    console.log(`Review stats result:`, reviewStats);

    // Get recent reviews for this product
    console.log(`=== FETCHING RECENT REVIEWS ===`);
    const recentReviews = await Review.findAll({
      where: { product_id: productId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    console.log(`Recent reviews result:`, recentReviews);

    // Calculate metrics
    const stats = orderStats[0] || {};
    const conversionRate =
      stats.total_orders && product.impressions
        ? (stats.total_orders / product.impressions) * 100
        : 0;

    const avgOrderValue =
      stats.total_revenue && stats.total_orders
        ? stats.total_revenue / stats.total_orders
        : 0;

    const reviewData = reviewStats[0] || {};

    console.log(`=== FINAL ANALYTICS DATA ===`);
    console.log(`Total reviews: ${reviewData.total_reviews || 0}`);
    console.log(`Average rating: ${reviewData.average_rating || 0}`);
    console.log(`Positive reviews: ${reviewData.positive_reviews || 0}`);
    console.log(`Negative reviews: ${reviewData.negative_reviews || 0}`);
    console.log(`Recent reviews count: ${recentReviews.length}`);

    return {
      product: {
        id: product.id,
        name: product.name,
        impressions: product.impressions,
        sold_units: product.sold_units,
        status: product.status,
      },
      analytics: {
        total_orders: parseInt(stats.total_orders) || 0,
        total_units_sold: parseInt(stats.total_units_sold) || 0,
        total_revenue: parseFloat(stats.total_revenue) || 0,
        average_sale_price: parseFloat(stats.average_sale_price) || 0,
        average_order_value: parseFloat(avgOrderValue),
        conversion_rate: parseFloat(conversionRate.toFixed(2)),
        first_sale_date: stats.first_sale_date,
        last_sale_date: stats.last_sale_date,
        monthly_sales: monthlySales,
        reviews: {
          total_reviews: parseInt(reviewData.total_reviews) || 0,
          average_rating: parseFloat(reviewData.average_rating) || 0,
          positive_reviews: parseInt(reviewData.positive_reviews) || 0,
          negative_reviews: parseInt(reviewData.negative_reviews) || 0,
          neutral_reviews: parseInt(reviewData.neutral_reviews) || 0,
          recent_reviews: recentReviews.map(review => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            created_at: review.created_at,
            user: {
              id: review.user.id,
              first_name: review.user.first_name,
              last_name: review.user.last_name,
              profile_image: review.user.profile_image
            }
          }))
        }
      },
    };
  }
}

module.exports = ProductService;