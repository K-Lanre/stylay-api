const { Collection, Product, CollectionProduct } = require('../models');
const { Op } = require('sequelize');
const slugify = require('slugify');
const AppError = require('../utils/appError');

/**
 * Create a new product collection
 * Collections allow grouping products for marketing and organizational purposes.
 * Admin access required. Prevents duplicate collection names.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.name - Collection name (required, must be unique)
 * @param {string} [req.body.description] - Collection description
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with created collection
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Object} res.body.data - Created collection object
 * @throws {AppError} 400 - Collection name already exists
 * @throws {Error} 500 - Server error during creation
 * @api {post} /api/v1/collections Create collection
 * @private Requires admin authentication
 * @example
 * POST /api/v1/collections
 * Authorization: Bearer <admin_jwt_token>
 * {
 *   "name": "Summer Collection",
 *   "description": "Latest summer fashion items"
 * }
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
 * Get all collections with optional filtering and pagination
 * Returns collections in reverse chronological order (newest first).
 * Supports filtering by name for search functionality.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.query} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Collections per page
 * @param {string} [req.query.name] - Filter collections by name (partial match)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated collections
 * @returns {Object} res.body.success - Response status (true)
 * @returns {number} res.body.count - Number of collections in current page
 * @returns {number} res.body.total - Total number of collections
 * @returns {Array} res.body.data - Array of collection objects
 * @throws {Error} 500 - Server error during retrieval
 * @api {get} /api/v1/collections Get collections
 * @public
 * @example
 * GET /api/v1/collections?page=1&limit=5&name=summer
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
 * Get collection by ID with associated products
 * Returns collection details including all products in the collection.
 * Includes product information through many-to-many relationship.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Collection ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with collection details
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Object} res.body.data - Collection object with products array
 * @throws {AppError} 404 - Collection not found
 * @throws {Error} 500 - Server error during retrieval
 * @api {get} /api/v1/collections/:id Get collection by ID
 * @public
 * @example
 * GET /api/v1/collections/123
 */
const getCollectionById = async (req, res, next) => {
  try {
    const collection = await Collection.findByPk(req.params.id, {
      include: [
        {
          model: Product,
          as: 'products',
          through: { attributes: [] },
          attributes: ['id', 'name', 'slug', 'price', 'thumbnail']
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


const getCollectionProducts = async (req, res, next) => {
  try {
    const collection = await Collection.findByPk(req.params.id, {
      include: [
        {
          model: Product,
          as: 'products',
          through: { attributes: [] },
          attributes: ['id', 'name', 'slug', 'price', 'thumbnail',  'description', 'created_at', 'updated_at']
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
 * Update collection information
 * Supports partial updates and validates name uniqueness when changed.
 * Admin access required for collection modifications.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Collection ID to update
 * @param {import('express').Request.body} req.body - Request body with updateable fields
 * @param {string} [req.body.name] - New collection name (must be unique)
 * @param {string} [req.body.description] - Updated description
 * @param {boolean} [req.body.is_public] - Public visibility setting
 * @param {boolean} [req.body.is_default] - Default collection flag
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated collection
 * @returns {Object} res.body.success - Response status (true)
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Updated collection object
 * @throws {AppError} 404 - Collection not found
 * @throws {AppError} 400 - Collection name already exists
 * @throws {Error} 500 - Server error during update
 * @api {put} /api/v1/collections/:id Update collection
 * @private Requires admin authentication
 * @example
 * PUT /api/v1/collections/123
 * Authorization: Bearer <admin_jwt_token>
 * {
 *   "name": "Updated Summer Collection",
 *   "description": "Updated collection description",
 *   "is_public": true
 * }
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
 * Delete collection and remove all product associations
 * Permanently removes collection and cleans up related data.
 * Admin access required for collection deletion.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Collection ID to delete
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Object} res.body.data - Empty object confirming deletion
 * @throws {AppError} 404 - Collection not found
 * @throws {Error} 500 - Server error during deletion
 * @api {delete} /api/v1/collections/:id Delete collection
 * @private Requires admin authentication
 * @example
 * DELETE /api/v1/collections/123
 * Authorization: Bearer <admin_jwt_token>
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
 * Add multiple products to a collection
 * Validates product existence and collection ownership.
 * Uses bulk operations for efficiency. Ignores duplicates.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Collection ID
 * @param {import('express').Request.body} req.body - Request body
 * @param {Array<number>} req.body.product_ids - Array of product IDs to add
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with operation details
 * @returns {Object} res.body.success - Response status (true)
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Operation result details
 * @returns {number} res.body.data.count - Number of products added
 * @throws {AppError} 404 - Collection not found or products not found
 * @throws {Error} 500 - Server error during bulk operation
 * @api {post} /api/v1/collections/:id/products Add products to collection
 * @private Requires admin authentication
 * @example
 * POST /api/v1/collections/123/products
 * Authorization: Bearer <admin_jwt_token>
 * {
 *   "product_ids": [456, 789, 101]
 * }
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
 * Remove multiple products from a collection
 * Validates collection existence and removes specified product associations.
 * Admin access required for collection management.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Collection ID
 * @param {import('express').Request.body} req.body - Request body
 * @param {Array<number>} req.body.product_ids - Array of product IDs to remove
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with operation details
 * @returns {Object} res.body.success - Response status (true)
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Operation result details
 * @returns {number} res.body.data.count - Number of products removed
 * @throws {AppError} 404 - Collection not found
 * @throws {Error} 500 - Server error during removal
 * @api {delete} /api/v1/collections/:id/products Remove products from collection
 * @private Requires admin authentication
 * @example
 * DELETE /api/v1/collections/123/products
 * Authorization: Bearer <admin_jwt_token>
 * {
 *   "product_ids": [456, 789]
 * }
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
  getCollectionProducts,
  updateCollection,
  deleteCollection,
  addProductsToCollection,
  removeProductsFromCollection
};
