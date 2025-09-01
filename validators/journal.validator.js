const { body, param } = require("express-validator");


// Export the validation rules as an array of middleware functions
module.exports = {
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
  
  getJournal: [
    param("id").isInt({ min: 1 }).withMessage("Invalid journal ID")
  ],
  
  deleteJournal: [
    param("id").isInt({ min: 1 }).withMessage("Invalid journal ID")
  ]
};
