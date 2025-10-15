const {
  Product,
  ProductVariant,
  ProductImage,
  Vendor,
  Category,
  Store,
  Review,
  sequelize,
} = require("../models");
const AppError = require("../utils/appError");
const { Op } = require("sequelize");
const slugify = require("slugify");

/**
 * Creates a new product for an approved vendor, with support for variants and images.
 * Only approved vendors can create products. Admins can create products for any vendor.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.body - Request body containing product data
 * @param {string} req.body.name - Product name (required)
 * @param {string} req.body.description - Product description (required)
 * @param {number} req.body.price - Product price (required)
 * @param {number} req.body.category_id - Category ID (required)
 * @param {string} req.body.sku - Product SKU (required)
 * @param {Array<Object>} [req.body.variants] - Product variants array
 * @param {Array<Object>} [req.body.images] - Product images array
 * @param {number} [req.body.vendor_id] - Vendor ID (admin only)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with created product data
 * @returns {Object} data - Response data
 * @returns {Object} data.data - Created product with associations
 * @returns {number} data.data.id - Product ID
 * @returns {string} data.data.name - Product name
 * @returns {string} data.data.slug - Product slug
 * @returns {string} data.data.description - Product description
 * @returns {number} data.data.price - Product price
 * @returns {string} data.data.sku - Product SKU
 * @returns {string} data.data.status - Product status ('active')
 * @returns {number} data.data.impressions - View count (0)
 * @returns {number} data.data.sold_units - Units sold (0)
 * @returns {Object} data.data.category - Product category
 * @returns {Object} data.data.vendor - Product vendor
 * @returns {Array} data.data.ProductVariants - Product variants
 * @returns {Array} data.data.images - Product images
 * @throws {AppError} 403 - When vendor is not approved or admin tries to create for unapproved vendor
 * @throws {AppError} 404 - When category not found
 * @throws {AppError} 400 - When required fields are missing
 * @api {post} /api/v1/products Create Product
 * @private vendor, admin
 * @example
 * // Request
 * POST /api/v1/products
 * Authorization: Bearer <token>
 * {
 *   "name": "Wireless Headphones",
 *   "description": "High-quality wireless headphones",
 *   "price": 99.99,
 *   "category_id": 1,
 *   "sku": "WH-001",
 *   "variants": [
 *     {"name": "Color", "value": "Black", "price_modifier": 0}
 *   ],
 *   "images": [
 *     {"url": "https://example.com/image1.jpg"}
 *   ]
 * }
 *
 * // Success Response (201)
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "name": "Wireless Headphones",
 *     "slug": "wireless-headphones",
 *     "description": "High-quality wireless headphones",
 *     "price": 99.99,
 *     "category": {"id": 1, "name": "Electronics"},
 *     "vendor": {"id": 1, "status": "approved"},
 *     "ProductVariants": [],
 *     "images": []
 *   }
 * }
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      category_id,
      sku,
      variants = [],
      images = [],
      vendor_id: vendorId // Optional vendor_id for admin
    } = req.body;

    let vendor;
    
    // If vendor_id is provided in request (admin case)
    if (vendorId) {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return next(new AppError("Only admins can create products for other vendors", 403));
      }
      
      vendor = await Vendor.findByPk(vendorId);
    } else {
      // Regular vendor creating their own product
      vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
      
      if (!vendor) {
        return next(new AppError("Vendor account not found", 404));
      }
    }

    // Check if vendor is approved
    if (vendor.status !== "approved") {
      return next(
        new AppError("Only approved vendors can create products", 403)
      );
    }

    // Check if category exists
    const category = await Category.findByPk(category_id);
    if (!category) {
      return next(new AppError("Category not found", 404));
    }

    // Generate unique slug from product name
    let slug = slugify(name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });

    // Check if slug already exists and make it unique if needed
    const slugCount = await Product.count({
      where: { slug: { [Op.like]: `${slug}%` } },
    });
    if (slugCount > 0) {
      const randomString = Math.random().toString(36).substring(2, 8);
      slug = `${slug}-${randomString}`;
    }

    // Create the product with the vendor's ID (not user ID)
    const product = await Product.create({
      vendor_id: vendor.id, // Use the vendor's ID from the vendors table
      category_id,
      name,
      slug,
      description,
      price,
      sku,
      status: "active",
      impressions: 0,
      sold_units: 0,
    });

    // Add variants if any
    if (variants && variants.length > 0) {
      await ProductVariant.bulkCreate(
        variants.map((variant) => ({
          ...variant,
          product_id: product.id,
        }))
      );
    }

    // Add images if any
    if (images && images.length > 0) {
      await ProductImage.bulkCreate(
        images.map((image, index) => ({
          product_id: product.id,
          image_url: image.url,
          is_featured: index === 0, // First image is featured by default
        }))
      );
    }

    // Fetch the created product with associations
    const createdProduct = await Product.findByPk(product.id, {
      include: [
        { model: ProductVariant, as: "variants" },
        { model: ProductImage, as: "images" },
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id", "status"],
          as: "vendor",
          include: [
            {
              model: Store,
              as: "store",
              attributes: ["id", "business_name"],
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: createdProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a paginated list of active products with optional filtering by category, vendor, and search terms.
 * Supports both numeric category IDs and category names/slugs for flexible filtering.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=12] - Number of products per page
 * @param {string|number} [req.query.category] - Category ID (numeric) or name/slug (string)
 * @param {number} [req.query.vendor] - Vendor ID to filter products by
 * @param {string} [req.query.search] - Search term for product name or description
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated product list
 * @returns {boolean} data.success - Success flag
 * @returns {number} data.count - Number of products in current page
 * @returns {number} data.total - Total number of products matching criteria
 * @returns {Array} data.data - Array of product objects
 * @returns {number} data.data[].id - Product ID
 * @returns {string} data.data[].name - Product name
 * @returns {string} data.data[].slug - Product slug
 * @returns {string} data.data[].description - Product description
 * @returns {number} data.data[].price - Product price
 * @returns {Object} data.data[].Category - Product category info
 * @returns {Object} data.data[].Vendor - Product vendor info
 * @returns {Array} data.data[].images - Product images (first image only)
 * @throws {AppError} 404 - When category filter is provided but category not found
 * @api {get} /api/v1/products Get All Products
 * @public
 * @example
 * // Request
 * GET /api/v1/products?page=1&limit=10&category=electronics&search=headphones
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 2,
 *   "total": 25,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Wireless Headphones",
 *       "slug": "wireless-headphones",
 *       "description": "High-quality wireless headphones",
 *       "price": 99.99,
 *       "Category": {"id": 1, "name": "Electronics"},
 *       "Vendor": {"id": 1},
 *       "images": [{"id": 1, "image_url": "https://example.com/image.jpg"}]
 *     }
 *   ]
 * }
 */
const getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, category, vendor, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Filter by category (supports both ID and name/slug)
    if (category) {
      // Check if category is a numeric ID or string (name/slug)
      const isNumericId = !isNaN(category) && !isNaN(parseFloat(category));

      if (isNumericId) {
        whereClause.category_id = parseInt(category);
      } else {
        // Find category by name or slug
        const categoryRecord = await Category.findOne({
          where: {
            [Op.or]: [
              { name: { [Op.like]: `%${category}%` } },
              { slug: category },
            ],
          },
        });

        if (categoryRecord) {
          whereClause.category_id = categoryRecord.id;
        } else {
          // Instead of throwing error, just log and continue without category filter
          console.log(`Category "${category}" not found, showing all products`);
          return next(new AppError("Category not found", 404));
        }
      }
    }

    // Filter by vendor
    if (vendor) {
      whereClause.vendor_id = vendor;
    }

    // Search by product name or description
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: products } = await Product.findAndCountAll({
      attributes: [
        "id",
        "vendor_id",
        "category_id",
        "name",
        "slug",
        "description",
        "thumbnail",
        "price",
        "discounted_price",
        "sku",
        "status",
        "impressions",
        "sold_units",
        "created_at",
        "updated_at"
      ],
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id"],
          as: "vendor",
        },
        { model: ProductImage, limit: 1, as: "images" }, // Only get first image for listing
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves detailed information about a specific product by its ID (numeric) or slug (string).
 * Increments product impression count for analytics purposes.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string|number} req.params.identifier - Product ID (number) or slug (string)
 * @param {Object} [req.user] - Authenticated user info (for viewer tracking)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with detailed product information
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Product details
 * @returns {number} data.data.id - Product ID
 * @returns {string} data.data.name - Product name
 * @returns {string} data.data.slug - Product slug
 * @returns {string} data.data.description - Product description
 * @returns {number} data.data.price - Product price
 * @returns {string} data.data.sku - Product SKU
 * @returns {string} data.data.status - Product status
 * @returns {number} data.data.impressions - Updated impression count
 * @returns {number} data.data.sold_units - Units sold
 * @returns {Object} data.data.Category - Product category
 * @returns {Object} data.data.Vendor - Product vendor with store info
 * @returns {Array} data.data.ProductVariants - Product variants
 * @returns {Array} data.data.ProductImages - Product images
 * @throws {AppError} 404 - When product is not found
 * @api {get} /api/v1/products/:identifier Get Product by ID/Slug
 * @public
 * @example
 * // Request by ID
 * GET /api/v1/products/123
 *
 * // Request by slug
 * GET /api/v1/products/wireless-headphones
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Wireless Headphones",
 *     "slug": "wireless-headphones",
 *     "description": "High-quality wireless headphones",
 *     "price": 99.99,
 *     "status": "active",
 *     "impressions": 156,
 *     "sold_units": 23,
 *     "Category": {"id": 1, "name": "Electronics"},
 *     "Vendor": {
 *       "id": 1,
 *       "status": "approved",
 *       "store": {"business_name": "Tech Store"}
 *     },
 *     "ProductVariants": [],
 *     "ProductImages": [
 *       {"id": 1, "image_url": "https://example.com/image.jpg"}
 *     ]
 *   }
 * }
 */
const getProductByIdentifier = async (req, res, next) => {
  try {
    const { identifier } = req.params;

    // Check if identifier is a number (ID) or string (slug)
    const isNumericId = !isNaN(identifier) && !isNaN(parseFloat(identifier));

    let whereClause = {};
    if (isNumericId) {
      whereClause.id = parseInt(identifier);
    } else {
      whereClause.slug = identifier;
    }

    const product = await Product.findOne({
      where: whereClause,
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id", "status"],
          as: "vendor",
          include: [
            {
              model: Store,
              as: "store",
              attributes: ["business_name"],
            },
          ],
        },
        { model: ProductVariant, as: "variants" },
        { model: ProductImage, as: "images" },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Increment impression count for analytics
    await Product.increment("impressions", {
      by: 1,
      where: { id: product.id },
    });

    // Track unique viewers (simplified - in production, use sessions/cookies)
    // For now, we'll increment viewers on each view, but you could implement
    // more sophisticated tracking based on user sessions
    const userId = req.user?.id;
    if (userId) {
      // Optional: Implement unique viewer tracking logic here
      // This could involve a separate table to track user-product views
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing product. Vendors can only update their own products.
 * Admins can update any product regardless of ownership.
 * Supports partial updates and automatically regenerates slug when name changes.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Product ID to update
 * @param {Object} req.body - Request body with update data
 * @param {string} [req.body.name] - New product name
 * @param {string} [req.body.description] - New product description
 * @param {number} [req.body.price] - New product price
 * @param {number} [req.body.category_id] - New category ID
 * @param {string} [req.body.sku] - New product SKU
 * @param {string} [req.body.status] - New product status
 * @param {Object} req.user - Authenticated user info
 * @param {Array} req.user.roles - User roles array
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated product data
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Updated product with associations
 * @returns {number} data.data.id - Product ID
 * @returns {string} data.data.name - Product name
 * @returns {string} data.data.slug - Product slug (regenerated if name changed)
 * @returns {string} data.data.description - Product description
 * @returns {number} data.data.price - Product price
 * @returns {string} data.data.sku - Product SKU
 * @returns {string} data.data.status - Product status
 * @returns {Object} data.data.category - Product category
 * @returns {Object} data.data.vendor - Product vendor with store info
 * @returns {Array} data.data.ProductVariants - Product variants
 * @returns {Array} data.data.images - Product images
 * @throws {AppError} 404 - When product or category not found
 * @throws {AppError} 403 - When user lacks permission to update product
 * @throws {AppError} 400 - When no valid fields provided for update
 * @api {put} /api/v1/products/:id Update Product
 * @private vendor, admin
 * @example
 * // Request
 * PUT /api/v1/products/123
 * Authorization: Bearer <token>
 * {
 *   "name": "Updated Headphones",
 *   "price": 89.99,
 *   "description": "Updated description"
 * }
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Updated Headphones",
 *     "slug": "updated-headphones",
 *     "price": 89.99,
 *     "description": "Updated description",
 *     "category": {"id": 1, "name": "Electronics"},
 *     "vendor": {"id": 1, "store": {"business_name": "Tech Store"}},
 *     "ProductVariants": [],
 *     "images": []
 *   }
 * }
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }
    // For admins, skip ownership check but still verify the product exists
    const isAdmin =
      req.user.roles && req.user.roles.some((role) => role.name === "admin");

    if (isAdmin) {
      // Just verify the vendor exists and is approved
      const vendor = await Vendor.findByPk(product.vendor_id, {
        attributes: ["id", "status"],
        as: "vendor",
      });

      if (!vendor) {
        return next(new AppError("Product vendor not found", 404));
      }

      if (vendor.status !== "approved") {
        return next(new AppError("Product vendor is not approved", 403));
      }

      // Continue with the update for admin
      next();
      return;
    }

    // For vendors, verify ownership and status
    const vendor = await Vendor.findOne({
      where: {
        user_id: req.user.id,
        id: product.vendor_id,
      },
      attributes: ["id", "status"],
      as: "vendor",
    });

    if (!vendor) {
      return next(new AppError("Not authorized to update this product", 403));
    }

    if (vendor.status !== "approved") {
      return next(new AppError("Your vendor account is not approved", 403));
    }

    // Prepare update data
    const updateData = {};
    const { name, description, price, category_id, sku, status } = req.body;

    // Handle category update
    if (category_id) {
      const category = await Category.findByPk(category_id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }
      updateData.category_id = category_id;
    }

    // Handle name and slug update
    if (name && name !== product.name) {
      updateData.name = name;

      // Generate new slug
      let slug = slugify(name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });

      // Append a unique identifier if slug already exists
      const existingProduct = await Product.findOne({
        where: {
          slug,
          id: { [Op.ne]: product.id }, // Exclude current product
        },
      });

      if (existingProduct) {
        slug = `${slug}-${Date.now()}`;
      }

      updateData.slug = slug;
    }

    // Add other fields to update
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (sku !== undefined) updateData.sku = sku;
    if (status !== undefined) updateData.status = status;

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return next(new AppError("No valid fields provided for update", 400));
    }

    // Update the product
    await product.update(updateData);

    // Fetch the updated product with associations
    const updatedProduct = await Product.findByPk(product.id, {
      include: [
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
        { model: ProductVariant, as: "variants" },
        { model: ProductImage, as: "images" },
      ],
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a product permanently. Vendors can only delete their own products.
 * Admins can delete any product regardless of ownership.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Product ID to delete
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for ownership verification
 * @param {string} req.user.role - User role ('admin' for admin access)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Empty object confirming deletion
 * @throws {AppError} 404 - When product not found
 * @throws {AppError} 403 - When user lacks permission to delete product
 * @api {delete} /api/v1/products/:id Delete Product
 * @private vendor, admin
 * @example
 * // Request
 * DELETE /api/v1/products/123
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {}
 * }
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Check if the current user is the product owner or admin
    if (product.vendor_id !== req.user.id && req.user.role !== "admin") {
      return next(new AppError("Not authorized to delete this product", 403));
    }

    await product.destroy();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a paginated list of all products belonging to a specific vendor.
 * Shows both active and inactive products for public access.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Vendor ID
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=12] - Number of products per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor's products
 * @returns {boolean} data.success - Success flag
 * @returns {number} data.count - Number of products in current page
 * @returns {number} data.total - Total number of products by vendor
 * @returns {Array} data.data - Array of product objects
 * @returns {number} data.data[].id - Product ID
 * @returns {string} data.data[].name - Product name
 * @returns {string} data.data[].slug - Product slug
 * @returns {string} data.data[].description - Product description
 * @returns {number} data.data[].price - Product price
 * @returns {Object} data.data[].Category - Product category
 * @returns {Array} data.data[].images - Product images (first image only)
 * @throws {AppError} 404 - When vendor not found
 * @api {get} /api/v1/products/vendors/:id Get Products by Vendor
 * @public
 * @example
 * // Request
 * GET /api/v1/products/vendors/5?page=1&limit=10
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 8,
 *   "total": 25,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Wireless Headphones",
 *       "slug": "wireless-headphones",
 *       "description": "High-quality wireless headphones",
 *       "price": 99.99,*
 *       "Category": {"id": 1, "name": "Electronics"},
 *       "images": [{"id": 1, "image_url": "https://example.com/image.jpg"}]
 *     }
 *   ]
 * }
 */
const getProductsByVendor = async (req, res, next) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    const vendor = await Vendor.findByPk(req.params.id);

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const { count, rows: products } = await Product.findAndCountAll({
      attributes: [
        "id",
        "vendor_id",
        "category_id",
        "name",
        "slug",
        "description",
        "thumbnail",
        "price",
        "discounted_price",
        "sku",
        "status",
        "impressions",
        "sold_units",
        "created_at",
        "updated_at"
      ],
      where: { vendor_id: req.params.id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        { model: ProductImage, limit: 1, as: "images" }, // Only get first image for listing
        {model: Review, as: "reviews"},
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a paginated list of all products (including inactive ones) with advanced admin filtering.
 * Provides comprehensive product listing with search, category, and vendor filters.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=12] - Number of products per page
 * @param {string} [req.query.search] - Search term for product name, description, or SKU
 * @param {number} [req.query.category] - Category ID filter
 * @param {number} [req.query.vendor] - Vendor ID filter
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with comprehensive product list
 * @returns {boolean} data.success - Success flag
 * @returns {number} data.count - Number of products in current page
 * @returns {number} data.total - Total number of products matching criteria
 * @returns {Array} data.data - Array of detailed product objects
 * @returns {number} data.data[].id - Product ID
 * @returns {string} data.data[].name - Product name
 * @returns {string} data.data[].description - Product description
 * @returns {number} data.data[].price - Product price
 * @returns {string} data.data[].sku - Product SKU
 * @returns {string} data.data[].status - Product status
 * @returns {Object} data.data[].Category - Product category
 * @returns {Object} data.data[].Vendor - Product vendor with business name and status
 * @returns {Array} data.data[].ProductImages - Product images
 * @returns {Array} data.data[].ProductVariants - Product variants
 * @api {get} /api/v1/products/admin/all Get All Products (Admin)
 * @private admin
 * @example
 * // Request
 * GET /api/v1/products/admin/all?page=1&limit=20&search=headphones&vendor=5
 * Authorization: Bearer <admin_token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 15,
 *   "total": 150,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Wireless Headphones",
 *       "description": "High-quality wireless headphones",
 *       "price": 99.99,
 *       "sku": "WH-001",
 *       "status": "active",
 *       "Category": {"id": 1, "name": "Electronics"},
 *       "Vendor": {"id": 5, "business_name": "Tech Store", "status": "approved"},
 *       "ProductImages": [],
 *       "ProductVariants": []
 *     }
 *   ]
 * }
 */
const getAllProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, search, category, vendor } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Apply filters if provided
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
      ];
    }

    if (category) whereClause.category_id = category;
    if (vendor) whereClause.vendor_id = vendor;

    const { count, rows: products } = await Product.findAndCountAll({
      attributes: [
        "id",
        "vendor_id",
        "category_id",
        "name",
        "slug",
        "description",
        "thumbnail",
        "price",
        "discounted_price",
        "sku",
        "status",
        "impressions",
        "sold_units",
        "created_at",
        "updated_at"
      ],
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id" ],
          as: "vendor",
          include: [
            {
              model: Store,
              attributes: ["id", "business_name", "status"],
              as: "store",
            },
          ],
        },
        { model: ProductImage, limit: 1, as: "images" },
        { model: ProductVariant, as: "variants" },
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Administrative update of any product regardless of ownership.
 * Allows full control over product data including category and vendor associations.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Product ID to update
 * @param {Object} req.body - Request body with update data
 * @param {string} [req.body.name] - New product name
 * @param {string} [req.body.description] - New product description
 * @param {number} [req.body.price] - New product price
 * @param {number} [req.body.category_id] - New category ID
 * @param {string} [req.body.sku] - New product SKU
 * @param {string} [req.body.status] - New product status
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated product data
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Updated product with all associations
 * @returns {number} data.data.id - Product ID
 * @returns {string} data.data.name - Product name
 * @returns {string} data.data.slug - Product slug (regenerated if name changed)
 * @returns {string} data.data.description - Product description
 * @returns {number} data.data.price - Product price
 * @returns {string} data.data.sku - Product SKU
 * @returns {string} data.data.status - Product status
 * @returns {Object} data.data.category - Product category
 * @returns {Object} data.data.vendor - Product vendor with store info
 * @returns {Array} data.data.ProductVariants - Product variants
 * @returns {Array} data.data.images - Product images
 * @throws {AppError} 404 - When product or category not found
 * @api {put} /api/v1/products/:id/admin Admin Update Product
 * @private admin
 * @example
 * // Request
 * PUT /api/v1/products/123/admin
 * Authorization: Bearer <admin_token>
 * {
 *   "name": "Admin Updated Product",
 *   "price": 79.99,
 *   "status": "inactive"
 * }
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Admin Updated Product",
 *     "slug": "admin-updated-product",
 *     "price": 79.99,
 *     "status": "inactive",
 *     "category": {"id": 1, "name": "Electronics"},
 *     "vendor": {"id": 1, "store": {"business_name": "Tech Store"}},
 *     "ProductVariants": [],
 *     "images": []
 *   }
 * }
 */
const adminUpdateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Category, attributes: ["id", "name"] },
        {
          model: Vendor,
          attributes: ["id", "user_id"],
          as: "vendor",
          include: {
            model: Store,
            as: "store",
            attributes: ["id", "business_name"],
          },
        },
        { model: ProductVariant, as: "variants" },
        { model: ProductImage, as: "images" },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Update product fields
    const { name, description, price, category_id, sku, status } = req.body;

    if (category_id) {
      const category = await Category.findByPk(category_id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }
    }

    // Generate new slug if name is being updated
    let slug = product.slug;
    if (name && name !== product.name) {
      slug = slugify(name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });

      // Check if slug already exists for another product
      const existingProduct = await Product.findOne({ where: { slug } });
      if (existingProduct && existingProduct.id !== product.id) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    await product.update({
      name: name || product.name,
      slug,
      description: description || product.description,
      price: price || product.price,
      category_id: category_id || product.category_id,
      sku: sku || product.sku,
      status: status || product.status,
    });

    // Fetch the updated product with associations
    const updatedProduct = await Product.findByPk(product.id, {
      include: [
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
        { model: ProductVariant, as: "variants" },
        { model: ProductImage, as: "images" },
      ],
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Administrative deletion of any product regardless of ownership.
 * Permanently removes product and all associated data.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Product ID to delete
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Empty object confirming deletion
 * @throws {AppError} 404 - When product not found
 * @api {delete} /api/v1/products/:id/admin Admin Delete Product
 * @private admin
 * @example
 * // Request
 * DELETE /api/v1/products/123/admin
 * Authorization: Bearer <admin_token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {}
 * }
 */
const adminDeleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    await product.destroy();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates the status of any product regardless of ownership.
 * Used for product approval workflow and status management.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Product ID to update status for
 * @param {Object} req.body - Request body
 * @param {string} req.body.status - New product status ('active', 'inactive', etc.)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated product status
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Updated product status information
 * @returns {number} data.data.id - Product ID
 * @returns {string} data.data.name - Product name
 * @returns {string} data.data.status - Updated product status
 * @returns {Object} data.data.vendor - Product vendor info
 * @returns {Object} data.data.category - Product category info
 * @throws {AppError} 404 - When product not found
 * @api {patch} /api/v1/products/:id/admin/status Update Product Status (Admin)
 * @private admin
 * @example
 * // Request
 * PATCH /api/v1/products/123/admin/status
 * Authorization: Bearer <admin_token>
 * {
 *   "status": "active"
 * }
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Wireless Headphones",
 *     "status": "active",
 *     "vendor": {"id": 1, "business_name": "Tech Store"},
 *     "category": {"id": 1, "name": "Electronics"}
 *   }
 * }
 */
const updateProductStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Vendor, attributes: ["id", "business_name"], as: "vendor" },
        { model: Category, attributes: ["id", "name"] },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    await product.update({ status });

    res.status(200).json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        status: product.status,
        vendor: product.Vendor,
        category: product.Category,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves products filtered by status with pagination.
 * Use 'all' as status to get all products regardless of status.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.status - Product status filter ('active', 'inactive', 'all', etc.)
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=12] - Number of products per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with filtered products
 * @returns {boolean} data.success - Success flag
 * @returns {number} data.count - Number of products in current page
 * @returns {number} data.total - Total number of products with specified status
 * @returns {Array} data.data - Array of product objects
 * @returns {number} data.data[].id - Product ID
 * @returns {string} data.data[].name - Product name
 * @returns {string} data.data[].slug - Product slug
 * @returns {string} data.data[].description - Product description
 * @returns {number} data.data[].price - Product price
 * @returns {string} data.data[].status - Product status
 * @returns {Object} data.data[].Category - Product category
 * @returns {Object} data.data[].Vendor - Product vendor info
 * @returns {Array} data.data[].images - Product images (first image only)
 * @api {get} /api/v1/products/admin/status/:status Get Products by Status (Admin)
 * @private admin
 * @example
 * // Request for active products
 * GET /api/v1/products/admin/status/active?page=1&limit=20
 * Authorization: Bearer <admin_token>
 *
 * // Request for all products
 * GET /api/v1/products/admin/status/all?page=1&limit=20
 * Authorization: Bearer <admin_token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 15,
 *   "total": 150,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "Wireless Headphones",
 *       "slug": "wireless-headphones",
 *       "description": "High-quality wireless headphones",
 *       "price": 99.99,
 *       "status": "active",
 *       "Category": {"id": 1, "name": "Electronics"},
 *       "Vendor": {"id": 5, "business_name": "Tech Store", "status": "approved"},
 *       "images": [{"id": 1, "image_url": "https://example.com/image.jpg"}]
 *     }
 *   ]
 * }
 */
const getProductsByStatus = async (req, res, next) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Only filter by status if not 'all'
    if (status !== "all") {
      whereClause.status = status;
    }

    const { count, rows: products } = await Product.findAndCountAll({
      attributes: [
        "id",
        "vendor_id",
        "category_id",
        "name",
        "slug",
        "description",
        "thumbnail",
        "price",
        "discounted_price",
        "sku",
        "status",
        "impressions",
        "sold_units",
        "created_at",
        "updated_at"
      ],
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id", "business_name", "status"],
          as: "vendor",
        },
        { model: ProductImage, limit: 1, as: "images" },
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves detailed analytics and metrics for a specific product.
 * Includes sales data, revenue, conversion rates, and monthly performance.
 * Vendors can only access analytics for their own products; admins can access any product.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Product ID for analytics
 * @param {Object} req.user - Authenticated user info
 * @param {Array} req.user.roles - User roles array
 * @param {number} req.user.id - User ID for ownership verification
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with comprehensive product analytics
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Analytics data container
 * @returns {Object} data.data.product - Basic product information
 * @returns {Object} data.data.analytics - Detailed analytics metrics
 * @returns {number} data.data.analytics.total_orders - Total number of orders
 * @returns {number} data.data.analytics.total_units_sold - Total units sold
 * @returns {number} data.data.analytics.total_revenue - Total revenue from product
 * @returns {number} data.data.analytics.average_sale_price - Average sale price
 * @returns {number} data.data.analytics.average_order_value - Average order value
 * @returns {number} data.data.analytics.conversion_rate - Conversion rate percentage
 * @returns {string} data.data.analytics.first_sale_date - Date of first sale
 * @returns {string} data.data.analytics.last_sale_date - Date of last sale
 * @returns {Array} data.data.analytics.monthly_sales - Monthly sales data for last 12 months
 * @throws {AppError} 404 - When product not found
 * @throws {AppError} 403 - When user lacks permission to view analytics
 * @api {get} /api/v1/products/:id/analytics Get Product Analytics
 * @private vendor, admin
 * @example
 * // Request
 * GET /api/v1/products/123/analytics
 * Authorization: Bearer <token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "product": {
 *       "id": 123,
 *       "name": "Wireless Headphones",
 *       "impressions": 1250,
 *       "sold_units": 45,
 *       "status": "active"
 *     },
 *     "analytics": {
 *       "total_orders": 38,
 *       "total_units_sold": 45,
 *       "total_revenue": 4495.50,
 *       "average_sale_price": 99.90,
 *       "average_order_value": 118.30,
 *       "conversion_rate": 3.04,
 *       "first_sale_date": "2024-01-15T10:30:00.000Z",
 *       "last_sale_date": "2024-09-20T14:22:00.000Z",
 *       "monthly_sales": [
 *         {"month": "2024-09", "orders_count": 8, "units_sold": 12, "revenue": 1198.80}
 *       ]
 *     }
 *   }
 * }
 */
const getProductAnalytics = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const isAdmin = req.user.roles.some(role => role.name === 'admin');
    const isVendor = req.user.roles.some(role => role.name === 'vendor');

    // Find the product
    const product = await Product.findByPk(productId, {
      include: [
        { model: Vendor, attributes: ["id", "user_id"], as: "vendor" },
        { model: Category, attributes: ["id", "name"] },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Check if user owns this product or is admin
    if (!isAdmin && !isVendor && product.vendor.user_id !== req.user.id) {
      return next(
        new AppError("Not authorized to view this product's analytics", 403)
      );
    }

    // Get order statistics for this product
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

    // Get monthly sales data for the last 12 months
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

    // Calculate conversion rate (orders per impression)
    const stats = orderStats[0] || {};
    const conversionRate =
      stats.total_orders && product.impressions
        ? (stats.total_orders / product.impressions) * 100
        : 0;

    // Calculate average order value for this product
    const avgOrderValue =
      stats.total_revenue && stats.total_orders
        ? stats.total_revenue / stats.total_orders
        : 0;

    res.status(200).json({
      success: true,
      data: {
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
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves comprehensive analytics summary for all products owned by a vendor.
 * Includes overall performance metrics, top-performing products, and aggregated statistics.
 * Only accessible to the vendor themselves.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID for vendor lookup
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with vendor analytics summary
 * @returns {boolean} data.success - Success flag
 * @returns {Object} data.data - Analytics data container
 * @returns {Object} data.data.summary - Overall vendor performance summary
 * @returns {number} data.data.summary.total_products - Total number of products
 * @returns {number} data.data.summary.active_products - Number of active products
 * @returns {number} data.data.summary.total_impressions - Total impressions across all products
 * @returns {number} data.data.summary.total_sold_units - Total units sold across all products
 * @returns {number} data.data.summary.avg_impressions_per_product - Average impressions per product
 * @returns {number} data.data.summary.avg_sales_per_product - Average sales per product
 * @returns {Array} data.data.top_products - Top 10 performing products
 * @returns {number} data.data.top_products[].id - Product ID
 * @returns {string} data.data.top_products[].name - Product name
 * @returns {number} data.data.top_products[].impressions - Product impressions
 * @returns {number} data.data.top_products[].sold_units - Units sold
 * @returns {number} data.data.top_products[].total_revenue - Total revenue from product
 * @returns {number} data.data.top_products[].total_orders - Total orders
 * @throws {AppError} 404 - When vendor account not found
 * @api {get} /api/v1/products/analytics/vendor Get Vendor Analytics Summary
 * @private vendor
 * @example
 * // Request
 * GET /api/v1/products/analytics/vendor
 * Authorization: Bearer <vendor_token>
 *
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "summary": {
 *       "total_products": 25,
 *       "active_products": 20,
 *       "total_impressions": 15420,
 *       "total_sold_units": 380,
 *       "avg_impressions_per_product": 616.80,
 *       "avg_sales_per_product": 15.20
 *     },
 *     "top_products": [
 *       {
 *         "id": 123,
 *         "name": "Wireless Headphones",
 *         "impressions": 1250,
 *         "sold_units": 45,
 *         "total_revenue": 4495.50,
 *         "total_orders": 38
 *       }
 *     ]
 *   }
 * }
 */
const getVendorAnalytics = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
    if (!vendor) {
      return next(new AppError("Vendor account not found", 404));
    }

    // Get overall vendor analytics
    const vendorStats = await sequelize.query(
      `
      SELECT
        COUNT(DISTINCT p.id) as total_products,
        SUM(p.impressions) as total_impressions,
        SUM(p.sold_units) as total_sold_units,
        COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_products,
        AVG(p.impressions) as avg_impressions_per_product,
        AVG(p.sold_units) as avg_sales_per_product
      FROM products p
      WHERE p.vendor_id = :vendorId
    `,
      {
        replacements: { vendorId: vendor.id },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Get top performing products
    const topProducts = await sequelize.query(
      `
      SELECT
        p.id,
        p.name,
        p.impressions,
        p.sold_units,
        COALESCE(SUM(oi.sub_total), 0) as total_revenue,
        COALESCE(COUNT(DISTINCT oi.order_id), 0) as total_orders
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'paid'
      WHERE p.vendor_id = :vendorId
      GROUP BY p.id, p.name, p.impressions, p.sold_units
      ORDER BY total_revenue DESC
      LIMIT 10
    `,
      {
        replacements: { vendorId: vendor.id },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const stats = vendorStats[0] || {};

    res.status(200).json({
      success: true,
      data: {
        summary: {
          total_products: parseInt(stats.total_products) || 0,
          active_products: parseInt(stats.active_products) || 0,
          total_impressions: parseInt(stats.total_impressions) || 0,
          total_sold_units: parseInt(stats.total_sold_units) || 0,
          avg_impressions_per_product:
            parseFloat(stats.avg_impressions_per_product) || 0,
          avg_sales_per_product: parseFloat(stats.avg_sales_per_product) || 0,
        },
        top_products: topProducts.map((product) => ({
          id: product.id,
          name: product.name,
          impressions: parseInt(product.impressions) || 0,
          sold_units: parseInt(product.sold_units) || 0,
          total_revenue: parseFloat(product.total_revenue) || 0,
          total_orders: parseInt(product.total_orders) || 0,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getProductByIdentifier,
  getProductsByVendor,
  getProductAnalytics,
  getVendorAnalytics,
  // Admin methods
  getAllProducts,
  adminUpdateProduct,
  adminDeleteProduct,
  updateProductStatus,
  getProductsByStatus,
};
