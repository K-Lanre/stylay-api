const { check } = require('express-validator');

// Validation rules for creating a collection
const createCollectionValidation = [
  check('name')
    .trim()
    .notEmpty()
    .withMessage('Collection name is required')
    .isLength({ max: 100 })
    .withMessage('Collection name must be less than 100 characters'),
    
  check('description')
    .optional()
    .trim()
    .isString()
    .withMessage('Description must be a string'),
    
];

// Validation rules for updating a collection
const updateCollectionValidation = [
  check('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Collection name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Collection name must be less than 100 characters'),
    
  check('description')
    .optional()
    .trim()
    .isString()
    .withMessage('Description must be a string'),
];

// Validation rules for collection ID parameter
const getCollectionValidation = [
  check('id')
    .isInt({ min: 1 })
    .withMessage('Invalid collection ID')
];

// Validation rules for deleting a collection
const deleteCollectionValidation = [
  check('id')
    .isInt({ min: 1 })
    .withMessage('Invalid collection ID')
];

module.exports = {
  createCollectionValidation,
  updateCollectionValidation,
  getCollectionValidation,
  deleteCollectionValidation
};
