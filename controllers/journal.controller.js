const { Journal, Product } = require('../models');
const { Op } = require('sequelize');

/**
 * Create a new journal entry
 * Journal entries can be standalone or linked to specific products.
 * Admin access required for content management and publishing.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.title - Journal entry title (required)
 * @param {string} req.body.content - Journal entry content (required)
 * @param {number} [req.body.product_id] - Associated product ID (optional)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with created journal entry
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - Created journal object with associations
 * @throws {Object} 400 - Validation errors (missing title/content, invalid product)
 * @throws {Error} 500 - Server error during creation
 * @api {post} /api/v1/journals Create journal entry
 * @private Requires admin authentication
 * @example
 * POST /api/v1/journals
 * Authorization: Bearer <admin_jwt_token>
 * {
 *   "title": "Summer Fashion Trends 2024",
 *   "content": "Exploring the latest trends in summer fashion...",
 *   "product_id": 123
 * }
 */
const createJournal = async (req, res, next) => {
  try {
    const { title, content, product_id } = req.body;
    
    // If product_id is provided, verify the product exists
    if (product_id) {
      const product = await Product.findByPk(product_id);
      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }
    }

    // Create the journal with explicit field mapping
    const journalData = {
      title: title.trim(),
      content: content.trim()
    };

    // Only add product_id if it exists
    if (product_id) {
      journalData.product_id = product_id;
    }

    const journal = await Journal.create(journalData, {
      returning: true,
      validate: true
    });

    // Fetch the created journal with all fields
    const createdJournal = await Journal.findByPk(journal.id, {
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name'],
        required: false // Make it a left join to include journals without products
      }]
    });

    res.status(201).json({
      status: 'success',
      data: {
        journal: createdJournal
      }
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      const errors = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors
      });
    }
    next(error);
  }
};

/**
 * Get all journal entries with optional filtering and pagination
 * Returns journals in reverse chronological order with associated product information.
 * Supports filtering by product ID for product-specific journals.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.query} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Journal entries per page
 * @param {number} [req.query.product_id] - Filter by associated product ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated journal entries
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - Journal entries with pagination info
 * @returns {Array} res.body.data.journals - Array of journal objects
 * @returns {number} res.body.data.total - Total number of journal entries
 * @returns {number} res.body.data.page - Current page number
 * @returns {number} res.body.data.pages - Total number of pages
 * @returns {number} res.body.data.limit - Items per page
 * @throws {Error} 500 - Server error during retrieval
 * @api {get} /api/v1/journals Get journal entries
 * @public
 * @example
 * GET /api/v1/journals?page=1&limit=5&product_id=123
 */
const getAllJournals = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, product_id } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (product_id) where.product_id = product_id;

    const { count, rows: journals } = await Journal.findAndCountAll({
      where,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'slug', 'thumbnail', 'price', 'discounted_price'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
        journals
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single journal entry by ID
 * Returns detailed journal information including associated product data if linked.
 * Public access for content consumption.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Journal entry ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with journal details
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - Journal object with product association
 * @throws {Object} 404 - Journal entry not found
 * @throws {Error} 500 - Server error during retrieval
 * @api {get} /api/v1/journals/:id Get journal by ID
 * @public
 * @example
 * GET /api/v1/journals/456
 */
const getJournalById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const journal = await Journal.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'slug', 'thumbnail', 'price', 'discounted_price'],
          required: false
        }
      ]
    });

    if (!journal) {
      return res.status(404).json({
        status: 'error',
        message: 'Journal entry not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        journal
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a journal entry
 * Supports partial updates to title, content, and product association.
 * Validates product existence when product_id is being updated.
 * Admin access required for content management.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Journal entry ID to update
 * @param {import('express').Request.body} req.body - Request body with updateable fields
 * @param {string} [req.body.title] - Updated journal title
 * @param {string} [req.body.content] - Updated journal content
 * @param {number} [req.body.product_id] - Updated associated product ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated journal
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - Updated journal object with associations
 * @throws {Object} 404 - Journal entry not found or invalid product ID
 * @throws {Error} 500 - Server error during update
 * @api {put} /api/v1/journals/:id Update journal entry
 * @private Requires admin authentication
 * @example
 * PUT /api/v1/journals/456
 * Authorization: Bearer <admin_jwt_token>
 * {
 *   "title": "Updated Summer Fashion Trends",
 *   "content": "Revised content about summer fashion..."
 * }
 */
const updateJournal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, product_id } = req.body;

    const journal = await Journal.findByPk(id);
    if (!journal) {
      return res.status(404).json({
        status: 'error',
        message: 'Journal entry not found'
      });
    }

    // If product_id is provided, verify the product exists
    if (product_id) {
      const product = await Product.findByPk(product_id);
      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (product_id !== undefined) updateData.product_id = product_id;

    // Update the journal
    await journal.update(updateData);

    // Fetch the updated journal with product details
    const updatedJournal = await Journal.findByPk(id, {
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'slug'],
        required: false
      }]
    });

    res.status(200).json({
      status: 'success',
      data: {
        journal: updatedJournal
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a journal entry
 * Permanently removes journal entry from database.
 * Admin access required for content management.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Journal entry ID to delete
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data - Null data confirming deletion
 * @throws {Object} 404 - Journal entry not found
 * @throws {Error} 500 - Server error during deletion
 * @api {delete} /api/v1/journals/:id Delete journal entry
 * @private Requires admin authentication
 * @example
 * DELETE /api/v1/journals/456
 * Authorization: Bearer <admin_jwt_token>
 */
const deleteJournal = async (req, res, next) => {
  try {
    const { id } = req.params;

    const journal = await Journal.findByPk(id);
    if (!journal) {
      return res.status(404).json({
        status: 'error',
        message: 'Journal entry not found'
      });
    }

    await journal.destroy();

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// Export all controller methods
const journalController = {
  createJournal,
  getAllJournals,
  getJournalById,
  updateJournal,
  deleteJournal
};

module.exports = journalController;
