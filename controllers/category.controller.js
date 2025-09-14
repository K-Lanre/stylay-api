const { Category, Product, Vendor, Store, ProductImage, Review, sequelize } = require('../models');
const { Op } = require('sequelize');
const slugify = require('slugify');

/**
 * @desc    Create a new category
 * @route   POST /api/v1/categories
 * @access  Private/Admin
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
 * @desc    Get all categories (with optional filtering and pagination)
 * @route   GET /api/v1/categories
 * @access  Public
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
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
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
 * @desc    Get category by ID
 * @route   GET /api/v1/categories/:id
 * @access  Public
 */
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id, {
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
 * @desc    Update category
 * @route   PUT /api/v1/categories/:id
 * @access  Private/Admin
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
 * @desc    Delete category
 * @route   DELETE /api/v1/categories/:id
 * @access  Private/Admin
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
 * @desc    Get category tree (nested categories)
 * @route   GET /api/v1/categories/tree
 * @access  Public
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
 * @desc    Get products by category
 * @route   GET /api/v1/categories/:id/products
 * @access  Public
 */
const getCategoryProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 12, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    // Check if category exists
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Build where clause
    const whereClause = {
      category_id: id,
      status: 'active' // Only show active products
    };

    // Price filtering
    if (minPrice) whereClause.price = { ...whereClause.price, [Op.gte]: parseFloat(minPrice) };
    if (maxPrice) whereClause.price = { ...whereClause.price, [Op.lte]: parseFloat(maxPrice) };

    // Sorting
    const order = [];
    const validSortFields = ['price', 'created_at', 'name'];
    const validSortOrders = ['ASC', 'DESC'];
    
    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder.toUpperCase())) {
      order.push([sortBy, sortOrder]);
    } else {
      order.push(['created_at', 'DESC']); // Default sort
    }

    // First, get the total count of products for pagination
    const totalCount = await Product.count({
      where: whereClause
    });

    // Then get the products with their related data
    const products = await Product.findAll({
      where: whereClause,
      include: [
        {
          model: Vendor,
          attributes: ['id', 'user_id'],
          include: [
            {
              model: Store,
              as: 'Store',
              attributes: ['id', 'business_name', 'logo']
            }
          ]
        },
        {
          model: Category,
          attributes: ['id', 'name', 'slug']
        },
        {
          model: ProductImage,
          attributes: ['id', 'image_url', 'is_featured'],
          required: false
        },
        {
          model: Review,
          attributes: [],
          required: false,
          duplicating: false
        }
      ],
      attributes: [
        'id', 'name', 'slug', 'description', 'price', 'discounted_price',
        'status', 'created_at',
        [
          sequelize.fn('IFNULL', 
            sequelize.fn('AVG', sequelize.col('Reviews.rating')), 
            0
          ), 
          'average_rating'
        ],
        [
          sequelize.fn('COUNT', sequelize.col('Reviews.id')), 
          'review_count'
        ]
      ],
      order,
      limit: parseInt(limit),
      offset: parseInt(offset),
      subQuery: false,
      group: ['Product.id', 'Vendor.id', 'Vendor->Store.id', 'Category.id', 'ProductImages.id']
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
        product_id: productIds
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

    // Add review stats to each product
    const productsWithReviews = products.map(product => {
      const stats = reviewStatsMap[product.id] || { average_rating: 0, review_count: 0 };
      return {
        ...product.get({ plain: true }),
        average_rating: stats.average_rating,
        review_count: stats.review_count
      };
    });

    res.status(200).json({
      success: true,
      data: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug
        },
        products: productsWithReviews,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          pages: Math.ceil(totalCount / limit),
          limit: parseInt(limit)
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
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryTree,
  getCategoryProducts
};
