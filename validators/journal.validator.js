const { body } = require('express-validator');
const { Journal } = require('../models');

// Validation rules for creating a new journal
exports.createJournal = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters'),
  
  body('excerpt')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Excerpt must not exceed 500 characters'),
  

body('tags')
     .optional()
     .custom((value) => {
       // Handle form-data where tags might be sent as JSON string
       if (typeof value === 'string') {
         try {
           value = JSON.parse(value);
         } catch (error) {
           throw new Error('Tags must be a valid JSON array or array');
         }
       }

       // Now validate the parsed value
       if (!Array.isArray(value)) {
         throw new Error('Tags must be an array');
       }

       if (value.length > 20) {
         throw new Error('Maximum 20 tags allowed');
       }

       if (value.some(tag => typeof tag !== 'string' || tag.length > 50)) {
         throw new Error('Tags must be strings with maximum 50 characters each');
       }

       return true;
     }),

  
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  
  body('featured_images')
    .optional()
    .isArray()
    .withMessage('Featured images must be an array')
    .custom((images) => {
      if (images.length > 10) {
        throw new Error('Maximum 10 featured images allowed');
      }
      // Validate each image object
      images.forEach(img => {
        if (!img.url || typeof img.url !== 'string') {
          throw new Error('Each featured image must have a valid URL');
        }
      });
      return true;
    })
];

// Validation rules for updating a journal
exports.updateJournal = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  
  body('content')
    .optional()
    .trim()
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters'),
  
  body('excerpt')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Excerpt must not exceed 500 characters'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags.length > 20) {
        throw new Error('Maximum 20 tags allowed');
      }
      if (tags.some(tag => typeof tag !== 'string' || tag.length > 50)) {
        throw new Error('Tags must be strings with maximum 50 characters each');
      }
      return true;
    })
    .custom(async (tags) => {
      if (!tags || tags.length === 0) return true;
      
      try {
        // Get all existing tags from journals
        const journals = await Journal.findAll({
          where: {
            tags: {
              [require('sequelize').Op.not]: null
            }
          },
          attributes: ['tags']
        });
        
        // Extract all existing tags
        const existingTags = new Set();
        journals.forEach(journal => {
          if (journal.tags && Array.isArray(journal.tags)) {
            journal.tags.forEach(tag => existingTags.add(tag.toLowerCase()));
          }
        });
        
        // Check if input tags exist
        const inputTags = tags.map(tag => tag.toLowerCase());
        const newTags = inputTags.filter(tag => !existingTags.has(tag));
        
        // Add tag existence info to request for potential use in controller
        return true;
      } catch (error) {
        console.error('Error checking existing tags:', error);
        return true; // Allow the validation to proceed even if check fails
      }
    }),
  
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  
  body('featured_images')
    .optional()
    .isArray()
    .withMessage('Featured images must be an array')
    .custom((images) => {
      if (images.length > 10) {
        throw new Error('Maximum 10 featured images allowed');
      }
      // Validate each image object
      images.forEach(img => {
        if (!img.url || typeof img.url !== 'string') {
          throw new Error('Each featured image must have a valid URL');
        }
      });
      return true;
    })
];

// Validation rules for getting a journal by ID
exports.getJournal = [
  // Add any needed validation for getting a journal by ID
];
