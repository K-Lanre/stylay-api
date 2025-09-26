const { check } = require('express-validator');

// Validation rules for creating a collection
/**
 * Validation rules for creating a new collection.
 * Validates collection name and optional description fields.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} name - Required, trimmed, 1-100 characters
 * @property {ValidationChain} description - Optional, trimmed, string validation
 * @returns {Array} Express validator middleware array for collection creation
 * @example
 * // Use in route:
 * router.post('/collections', createCollectionValidation, createCollection);
 */
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
/**
 * Validation rules for updating an existing collection.
 * Validates optional collection name and description updates.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} name - Optional, trimmed, not empty, 1-100 characters
 * @property {ValidationChain} description - Optional, trimmed, string validation
 * @returns {Array} Express validator middleware array for collection updates
 * @example
 * // Use in route:
 * router.put('/collections/:id', updateCollectionValidation, updateCollection);
 */
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
/**
 * Validation rules for collection ID parameter validation.
 * Ensures the provided collection ID is a valid positive integer.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required collection ID parameter, integer >= 1
 * @returns {Array} Express validator middleware array for collection ID validation
 * @example
 * // Use in route:
 * router.get('/collections/:id', getCollectionValidation, getCollection);
 */
const getCollectionValidation = [
  check('id')
    .isInt({ min: 1 })
    .withMessage('Invalid collection ID')
];

// Validation rules for deleting a collection
/**
 * Validation rules for deleting a collection.
 * Validates the collection ID parameter for deletion operations.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required collection ID parameter, integer >= 1
 * @returns {Array} Express validator middleware array for collection deletion
 * @example
 * // Use in route:
 * router.delete('/collections/:id', deleteCollectionValidation, deleteCollection);
 */
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
