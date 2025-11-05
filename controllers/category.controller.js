const { Category, Product, Vendor, Store, ProductImage, Review, sequelize } = require('../models');
const { Op } = require('sequelize');
const slugify = require('slugify');

/**
 * Create a new product category
 * Generates unique slug from category name and supports hierarchical categories.
 * Admin access required for category creation and management.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.name - Category name (required)
 * @param {number} [req.body.parent_id] - Parent category ID for hierarchical categories
 * @param {string} [req.body.description] - Category description
 * @param {string} [req.body.image] - Category image URL
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with created category
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Object} res.body.data - Created category object
 * @throws {Error} 500 - Server error during creation or slug generation
 * @api {post} /api/v1/categories Create category
 * @private Requires admin authentication
 * @example
 * POST /api/v1/categories
 * Authorization: Bearer <admin_jwt_token>
 * {
 *   "name": "Electronics",
 *   "description": "Electronic devices and accessories",
 *   "parent_id": null,
 *   "image": "https://example.com/electronics.jpg"
 * }
 */
const createCategory = async (req, res) => {
  try {
    const { name, parent_id, description, image } = req.body;
    const slug = req.body.slug || slugify(name, { lower: true, strict: true });

    const category = await Category.create({
      name,
      slug,
      parent_id: parent_id || null,
      description: description || null,
      image: image || null
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all categories with filtering and pagination
 * Supports hierarchical category display with parent-child relationships.
 * Includes search functionality and flexible filtering options.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.query} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of categories per page
 * @param {number|string} [req.query.parent_id] - Filter by parent category ID or 'null' for root categories
 * @param {string} [req.query.search] - Search term for category name or description
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated categories
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Array} res.body.data - Array of category objects with parent/child relationships
 * @returns {Object} res.body.pagination - Pagination metadata
 * @returns {number} res.body.pagination.total - Total number of categories
 * @returns {number} res.body.pagination.page - Current page number
 * @returns {number} res.body.pagination.pages - Total number of pages
 * @returns {number} res.body.pagination.limit - Items per page
 * @throws {Error} 500 - Server error during category retrieval
 * @api {get} /api/v1/categories Get categories
 * @public
 * @example
 * GET /api/v1/categories?page=1&limit=5&parent_id=null
 * GET /api/v1/categories?search=electronics
 */
const getCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10, parent_id, search } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    
    if (parent_id === 'null' || parent_id === '') {
      whereClause.parent_id = null;
    } else if (parent_id) {
      whereClause.parent_id = parent_id;
    }
    
    if (search) {
      const searchTerm = search.toLowerCase();
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${searchTerm}%` } },
        { description: { [Op.like]: `%${searchTerm}%` } }
      ];
    }
    
    const { count, rows: categories } = await Category.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['name', 'ASC']],
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: Category,
          as: 'children',
          attributes: ['id', 'name', 'slug']
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get category by ID or slug with full details
 * Supports both numeric IDs and URL-friendly slugs for category identification.
 * Returns category with parent and child relationships.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.identifier - Category ID (numeric) or slug (string)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with category details
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Object} res.body.data - Category object with parent and children
 * @throws {Object} 404 - Category not found
 * @throws {Error} 500 - Server error during category retrieval
 * @api {get} /api/v1/categories/:identifier Get category by ID/slug
 * @public
 * @example
 * GET /api/v1/categories/123
 * GET /api/v1/categories/electronics
 */
const getCategoryByIdentifier = async (req, res) => {
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

    const category = await Category.findOne({
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: Category,
          as: 'children',
          attributes: ['id', 'name', 'slug', 'image']
        }
      ]
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



/**
 * Update category information
 * Supports partial updates and automatically generates new slug when name changes.
 * Admin access required for category modifications.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Category ID to update
 * @param {import('express').Request.body} req.body - Request body with updateable fields
 * @param {string} [req.body.name] - New category name (triggers slug regeneration)
 * @param {string} [req.body.slug] - Custom slug (overrides auto-generated)
 * @param {number} [req.body.parent_id] - Parent category ID
 * @param {string} [req.body.description] - Category description
 * @param {string} [req.body.image] - Category image URL
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated category
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Object} res.body.data - Updated category object
 * @throws {Object} 404 - Category not found
 * @throws {Error} 500 - Server error during update
 * @api {put} /api/v1/categories/:id Update category
 * @private Requires admin authentication
 * @example
 * PUT /api/v1/categories/123
 * Authorization: Bearer <admin_jwt_token>
 * {
 *   "name": "Updated Electronics",
 *   "description": "Updated category description"
 * }
 */
const updateCategory = async (req, res) => {
  try {
    const { name, slug, parent_id, description, image } = req.body;
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Update category fields
    category.name = name || category.name;
    // If name is being updated, update the slug as well
    if (name && name !== category.name) {
      category.slug = slugify(name, { lower: true, strict: true });
    } else {
      category.slug = slug || category.slug;
    }
    category.parent_id = parent_id !== undefined ? parent_id : category.parent_id;
    category.description = description !== undefined ? description : category.description;
    category.image = image !== undefined ? image : category.image;

    await category.save();

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete category
 * Permanently removes category from database. Admin access required.
 * Note: Consider cascade effects on products and subcategories.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Category ID to delete
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 * @returns {Object} res.body.success - Response status (true)
 * @returns {string} res.body.message - Success message
 * @throws {Object} 404 - Category not found
 * @throws {Error} 500 - Server error during deletion
 * @api {delete} /api/v1/categories/:id Delete category
 * @private Requires admin authentication
 * @example
 * DELETE /api/v1/categories/123
 * Authorization: Bearer <admin_jwt_token>
 */
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    await category.destroy();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get hierarchical category tree
 * Returns nested category structure with unlimited depth.
 * Useful for building category navigation menus and filters.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with nested category tree
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Array} res.body.data - Array of root categories with nested children
 * @returns {Object} res.body.data[].children - Child categories (recursive)
 * @throws {Error} 500 - Server error during tree generation
 * @api {get} /api/v1/categories/tree Get category tree
 * @public
 * @example
 * GET /api/v1/categories/tree
 *
 * // Response structure:
 * [
 *   {
 *     "id": 1,
 *     "name": "Electronics",
 *     "slug": "electronics",
 *     "children": [
 *       {
 *         "id": 2,
 *         "name": "Smartphones",
 *         "slug": "smartphones",
 *         "children": []
 *       }
 *     ]
 *   }
 * ]
 */
const getCategoryTree = async (req, res) => {
  try {
    const buildTree = async (parentId = null) => {
      const categories = await Category.findAll({
        where: { parent_id: parentId },
        attributes: ['id', 'name', 'slug', 'image'],
        order: [['name', 'ASC']]
      });

      const result = [];
      
      for (const category of categories) {
        const children = await buildTree(category.id);
        result.push({
          ...category.toJSON(),
          children: children.length ? children : undefined
        });
      }
      
      return result;
    };

    const categoryTree = await buildTree();

    res.status(200).json({
      success: true,
      data: categoryTree
    });
  } catch (error) {
    console.error('Error fetching category tree:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category tree',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get products belonging to a category with advanced filtering
 * Supports hierarchical category queries (includes subcategories), price filtering,
 * sorting options, and pagination. Includes product reviews and vendor information.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Category ID or slug
 * @param {import('express').Request.query} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=12] - Products per page
 * @param {number} [req.query.minPrice] - Minimum price filter
 * @param {number} [req.query.maxPrice] - Maximum price filter
 * @param {string} [req.query.sortBy='createdAt'] - Sort field (createdAt, price, name)
 * @param {string} [req.query.sortOrder='DESC'] - Sort order (ASC, DESC)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with category products
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Object} res.body.data - Products data with category info
 * @returns {Object} res.body.data.category - Category details
 * @returns {Array} res.body.data.products - Array of products with reviews
 * @returns {Object} res.body.data.pagination - Pagination metadata
 * @throws {Object} 404 - Category not found
 * @throws {Error} 500 - Server error during product retrieval
 * @api {get} /api/v1/categories/:id/products Get category products
 * @public
 * @example
 * GET /api/v1/categories/electronics/products?page=1&limit=6&minPrice=100&maxPrice=500&sortBy=price&sortOrder=ASC
 *
 * // Supports both ID and slug:
 * GET /api/v1/categories/electronics/products
 * GET /api/v1/categories/123/products
 */
const getCategoryProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 12, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Check if category exists (support both ID and slug)
    const isNumericId = !isNaN(id) && !isNaN(parseFloat(id));
    const categoryWhereClause = isNumericId ? { id: parseInt(id) } : { slug: id };

    const category = await Category.findOne({ where: categoryWhereClause });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get category IDs: always include self; for parent categories, include direct children
    let categoryIds = [category.id];
    if (category.parent_id === null) {
      const directChildren = await Category.findAll({
        where: { parent_id: category.id },
        attributes: ['id'],
        raw: true
      });
      categoryIds = [...categoryIds, ...directChildren.map(c => c.id)]; // Use category.id instead of id
    }

    // Build where clause
    const whereClause = {
      category_id: { [Op.in]: categoryIds },
      status: 'active' // Only show active products
    };

    // Price filtering
    const priceFilter = {};
    if (minPrice) {
      priceFilter[Op.gte] = parseFloat(minPrice);
    }
    if (maxPrice) {
      priceFilter[Op.lte] = parseFloat(maxPrice);
    }
    if (Object.keys(priceFilter).length > 0) {
      whereClause.price = priceFilter;
    }

    // Sorting
    const sortFieldMap = {
      'createdAt': 'created_at',
      'price': 'price',
      'name': 'name'
    };
    let actualSortBy = sortFieldMap[sortBy] || 'created_at';
    const actualSortOrder = sortOrder.toUpperCase();
    const validSortFields = Object.values(sortFieldMap);
    const validSortOrders = ['ASC', 'DESC'];
    const order = [];
    if (validSortFields.includes(actualSortBy) && validSortOrders.includes(actualSortOrder)) {
      order.push([actualSortBy, actualSortOrder]);
    } else {
      order.push(['created_at', 'DESC']); // Default sort
    }

    // Get the total count of products for pagination using Sequelize's count method
    const totalCount = await Product.count({
      where: whereClause,
      distinct: true,
      col: 'id'
    });

    // Get the products with their related data (removed Review include to avoid duplicates; fetch stats separately)
    const products = await Product.findAll({
      where: whereClause,
      include: [
        {
          model: Vendor,
          as: 'vendor', // Use the same alias as defined in the Product model
          attributes: ['id', 'user_id'],
          include: [
            {
              model: Store,
              as: 'store', // Use the same alias as defined in the Vendor model
              attributes: ['id', 'business_name', 'logo']
            }
          ]
        },
        {
          model: Category,
          attributes: ['id', 'name', 'slug', 'parent_id']
        },
        {
          model: ProductImage,
          as: 'images', // Added the required alias to match the association
          attributes: ['id', 'image_url', 'is_featured'],
          where: { is_featured: true }, // Only include featured image to avoid duplicates
          required: false
        }
      ],
      attributes: [
        'id', 'name', 'slug', 'description', 'price', 'discounted_price',
        'status', 'created_at', 'category_id', 'thumbnail'
      ],
      order,
      limit: limitNum,
      offset,
      subQuery: false,
      group: ['Product.id', 'Vendor.id', 'Vendor.store.id', 'Category.id', 'images.id']
    });

    // Get review stats for all products in one query
    const productIds = products.map(p => p.id);
    const reviewStats = await Review.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'review_count']
      ],
      where: {
        product_id: { [Op.in]: productIds }
      },
      group: ['product_id'],
      raw: true
    });

    // Create a map of product_id to review stats
    const reviewStatsMap = reviewStats.reduce((acc, stat) => {
      acc[stat.product_id] = {
        average_rating: parseFloat(stat.avg_rating) || 0,
        review_count: parseInt(stat.review_count) || 0
      };
      return acc;
    }, {});

    // Add review stats and category info to each product
    const productsWithReviews = products.map(product => {
      const stats = reviewStatsMap[product.id] || { average_rating: 0, review_count: 0 };
      const productData = product.get({ plain: true });
      
      return {
        ...productData,
        average_rating: stats.average_rating,
        review_count: stats.review_count,
        category: {
          id: product.Category.id,
          name: product.Category.name,
          slug: product.Category.slug,
          is_parent: product.Category.parent_id === null
        }
      };
    });

    // Get child categories if this is a parent category
    let childCategories = [];
    if (category.parent_id === null) {
      childCategories = await Category.findAll({
        where: { parent_id: category.id },
        attributes: ['id', 'name', 'slug'],
        raw: true
      });
    }

    res.status(200).json({
      success: true,
      data: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          is_parent: category.parent_id === null,
          child_categories: childCategories
        },
        products: productsWithReviews,
        pagination: {
          total: totalCount,
          page: pageNum,
          pages: Math.ceil(totalCount / limitNum),
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryByIdentifier,
  updateCategory,
  deleteCategory,
  getCategoryTree,
  getCategoryProducts
};
