const { Journal, Product } = require('../models');
const { Op } = require('sequelize');

/**
 * @desc    Create a new journal entry
 * @route   POST /api/v1/journals
 * @access  Private/Admin
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
 * @desc    Get all journal entries
 * @route   GET /api/v1/journals
 * @access  Public
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
          attributes: ['id', 'name', 'slug'],
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
 * @desc    Get a single journal entry
 * @route   GET /api/v1/journals/:id
 * @access  Public
 */
const getJournalById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const journal = await Journal.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'slug'],
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
 * @desc    Update a journal entry
 * @route   PUT /api/v1/journals/:id
 * @access  Private/Admin
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
 * @desc    Delete a journal entry
 * @route   DELETE /api/v1/journals/:id
 * @access  Private/Admin
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
