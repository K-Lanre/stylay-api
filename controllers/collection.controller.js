const { Collection, Product, CollectionProduct } = require('../models');
const { Op } = require('sequelize');
const slugify = require('slugify');
const AppError = require('../utils/appError');

/**
 * @desc    Create a new collection
 * @route   POST /api/v1/collections
 * @access  Private/Admin
 */
const createCollection = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    // Check if collection with same name already exists
    const existingCollection = await Collection.findOne({
      where: { name }
    });

    if (existingCollection) {
      return next(new AppError('A collection with this name already exists', 400));
    }

    const collection = await Collection.create({
      name,
      description: description || null
    });

    res.status(201).json({
      success: true,
      data: collection
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all collections (with optional filtering and pagination)
 * @route   GET /api/v1/collections
 * @access  Public
 */
const getCollections = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, name } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    
    if (name) {
      whereClause.name = { [Op.like]: `%${name}%` };
    }

    const { count, rows: collections } = await Collection.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: collections.length,
      total: count,
      data: collections
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get collection by ID
 * @route   GET /api/v1/collections/:id
 * @access  Public
 */
const getCollectionById = async (req, res, next) => {
  try {
    const collection = await Collection.findByPk(req.params.id, {
      include: [
        {
          model: Product,
          as: 'products',
          through: { attributes: [] },
          attributes: ['id', 'name', 'slug', 'price', 'main_image']
        }
      ]
    });

    if (!collection) {
      return next(new AppError('No collection found with that ID', 404));
    }

    res.status(200).json({
      success: true,
      data: collection
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update collection
 * @route   PUT /api/v1/collections/:id
 * @access  Private/Admin
 */
const updateCollection = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    const collection = await Collection.findByPk(req.params.id);
    
    if (!collection) {
      return next(new AppError('No collection found with that ID', 404));
    }

    // If name is being updated, check for duplicates
    if (name && name !== collection.name) {
      const existingCollection = await Collection.findOne({
        where: { name, id: { [Op.ne]: collection.id } }
      });

      if (existingCollection) {
        return next(new AppError('A collection with this name already exists', 400));
      }
    }

    // Update collection
    await collection.update({
      name: name || collection.name,
      description: description !== undefined ? description : collection.description
    });

    // Fetch the updated collection
    const updatedCollection = await Collection.findByPk(collection.id);

    res.status(200).json({
      success: true,
      data: updatedCollection
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete collection
 * @route   DELETE /api/v1/collections/:id
 * @access  Private/Admin
 */
const deleteCollection = async (req, res, next) => {
  try {
    const collection = await Collection.findByPk(req.params.id);
    
    if (!collection) {
      return next(new AppError('No collection found with that ID', 404));
    }

    // First remove all product associations
    await CollectionProduct.destroy({
      where: { collection_id: collection.id }
    });

    // Then delete the collection
    await collection.destroy();

    res.status(204).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add products to collection
 * @route   POST /api/v1/collections/:id/products
 * @access  Private/Admin
 */
const addProductsToCollection = async (req, res, next) => {
  try {
    const { product_ids } = req.body;
    const collectionId = req.params.id;

    // Verify collection exists
    const collection = await Collection.findByPk(collectionId);
    if (!collection) {
      return next(new AppError('No collection found with that ID', 404));
    }

    // Verify all product IDs exist
    const products = await Product.findAll({
      where: { id: product_ids }
    });

    if (products.length !== product_ids.length) {
      return next(new AppError('One or more products not found', 404));
    }

    // Add products to collection
    const collectionProducts = product_ids.map(product_id => ({
      collection_id: collectionId,
      product_id
    }));

    await CollectionProduct.bulkCreate(collectionProducts, {
      ignoreDuplicates: true
    });

    res.status(200).json({
      success: true,
      message: 'Products added to collection successfully',
      data: { count: product_ids.length }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove products from collection
 * @route   DELETE /api/v1/collections/:id/products
 * @access  Private/Admin
 */
const removeProductsFromCollection = async (req, res, next) => {
  try {
    const { product_ids } = req.body;
    const collectionId = req.params.id;

    // Verify collection exists
    const collection = await Collection.findByPk(collectionId);
    if (!collection) {
      return next(new AppError('No collection found with that ID', 404));
    }

    // Remove products from collection
    await CollectionProduct.destroy({
      where: {
        collection_id: collectionId,
        product_id: product_ids
      }
    });

    res.status(200).json({
      success: true,
      message: 'Products removed from collection successfully',
      data: { count: product_ids.length }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCollection,
  getCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
  addProductsToCollection,
  removeProductsFromCollection
};
