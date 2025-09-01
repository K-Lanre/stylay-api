const { Category } = require('../models');
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

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryTree
};
