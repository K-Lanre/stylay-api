const { body, param } = require("express-validator");


// Export the validation rules as an array of middleware functions
/**
 * Validation rules for journal operations.
 * @namespace JournalValidators
 */
module.exports = {
  /**
   * Validation rules for creating a new journal entry.
   * Validates title, content, and optional product association.
   * @type {Array<ValidationChain>} Array of express-validator validation chains
   * @property {ValidationChain} title - Required, trimmed, 5-255 characters
   * @property {ValidationChain} content - Required, trimmed, minimum 10 characters
   * @property {ValidationChain} product_id - Optional, positive integer
   * @returns {Array} Express validator middleware array for journal creation
   * @example
   * // Use in route:
   * router.post('/journals', journalValidators.createJournal, createJournal);
   */
  createJournal: [
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ min: 5, max: 255 })
      .withMessage("Title must be between 5 and 255 characters"),
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Content is required")
      .isLength({ min: 10 })
      .withMessage("Content must be at least 10 characters"),
    body("product_id")
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage("Product ID must be a positive integer")
  ],
  
  /**
   * Validation rules for updating an existing journal entry.
   * Validates journal ID parameter and optional content updates.
   * @type {Array<ValidationChain>} Array of express-validator validation chains
   * @property {ValidationChain} id - Required journal ID parameter, integer >= 1
   * @property {ValidationChain} title - Optional, trimmed, 5-255 characters
   * @property {ValidationChain} content - Optional, trimmed, minimum 10 characters
   * @property {ValidationChain} product_id - Optional, positive integer
   * @returns {Array} Express validator middleware array for journal updates
   * @example
   * // Use in route:
   * router.put('/journals/:id', journalValidators.updateJournal, updateJournal);
   */
  updateJournal: [
    param("id").isInt({ min: 1 }).withMessage("Invalid journal ID"),
    body("title")
      .optional()
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage("Title must be between 5 and 255 characters"),
    body("content")
      .optional()
      .trim()
      .isLength({ min: 10 })
      .withMessage("Content must be at least 10 characters"),
    body("product_id")
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage("Product ID must be a positive integer")
  ],
  
  /**
   * Validation rules for retrieving a journal entry by ID.
   * Validates the journal ID parameter.
   * @type {Array<ValidationChain>} Array of express-validator validation chains
   * @property {ValidationChain} id - Required journal ID parameter, integer >= 1
   * @returns {Array} Express validator middleware array for journal retrieval
   * @example
   * // Use in route:
   * router.get('/journals/:id', journalValidators.getJournal, getJournal);
   */
  getJournal: [
    param("id").isInt({ min: 1 }).withMessage("Invalid journal ID")
  ],
  
  /**
   * Validation rules for deleting a journal entry.
   * Validates the journal ID parameter for deletion operations.
   * @type {Array<ValidationChain>} Array of express-validator validation chains
   * @property {ValidationChain} id - Required journal ID parameter, integer >= 1
   * @returns {Array} Express validator middleware array for journal deletion
   * @example
   * // Use in route:
   * router.delete('/journals/:id', journalValidators.deleteJournal, deleteJournal);
   */
  deleteJournal: [
    param("id").isInt({ min: 1 }).withMessage("Invalid journal ID")
  ]
};
