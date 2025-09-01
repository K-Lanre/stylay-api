const { body, param } = require('express-validator');

// Validation for creating an address
exports.createAddressValidation = [
  body('label')
    .optional()
    .isString().withMessage('Label must be a string')
    .isLength({ max: 50 }).withMessage('Label must be less than 50 characters'),
  
  body('address_line')
    .notEmpty().withMessage('Address line is required')
    .isString().withMessage('Address line must be a string')
    .isLength({ max: 255 }).withMessage('Address line must be less than 255 characters'),
  
  body('city')
    .notEmpty().withMessage('City is required')
    .isString().withMessage('City must be a string')
    .isLength({ max: 100 }).withMessage('City must be less than 100 characters'),
  
  body('state')
    .notEmpty().withMessage('State is required')
    .isString().withMessage('State must be a string')
    .isLength({ max: 100 }).withMessage('State must be less than 100 characters'),
  
  body('country')
    .notEmpty().withMessage('Country is required')
    .isString().withMessage('Country must be a string')
    .isLength({ max: 100 }).withMessage('Country must be less than 100 characters'),
  
  body('postal_code')
    .optional()
    .isString().withMessage('Postal code must be a string')
    .isLength({ max: 20 }).withMessage('Postal code must be less than 20 characters'),
  
  body('is_default')
    .optional()
    .isBoolean().withMessage('is_default must be a boolean'),
  
  body('phone_number')
    .optional()
    .isString().withMessage('Phone number must be a string')
    .isLength({ max: 20 }).withMessage('Phone number must be less than 20 characters'),
  
  body('additional_info')
    .optional()
    .isString().withMessage('Additional info must be a string')
    .isLength({ max: 500 }).withMessage('Additional info must be less than 500 characters')
];

// Validation for updating an address
exports.updateAddressValidation = [
  param('id')
    .notEmpty().withMessage('Address ID is required')
    .isInt({ min: 1 }).withMessage('Invalid address ID'),
  
  body('label')
    .optional()
    .isString().withMessage('Label must be a string')
    .isLength({ max: 50 }).withMessage('Label must be less than 50 characters'),
  
  body('address_line')
    .optional()
    .isString().withMessage('Address line must be a string')
    .isLength({ max: 255 }).withMessage('Address line must be less than 255 characters'),
  
  body('city')
    .optional()
    .isString().withMessage('City must be a string')
    .isLength({ max: 100 }).withMessage('City must be less than 100 characters'),
  
  body('state')
    .optional()
    .isString().withMessage('State must be a string')
    .isLength({ max: 100 }).withMessage('State must be less than 100 characters'),
  
  body('country')
    .optional()
    .isString().withMessage('Country must be a string')
    .isLength({ max: 100 }).withMessage('Country must be less than 100 characters'),
  
  body('postal_code')
    .optional()
    .isString().withMessage('Postal code must be a string')
    .isLength({ max: 20 }).withMessage('Postal code must be less than 20 characters'),
  
  body('is_default')
    .optional()
    .isBoolean().withMessage('is_default must be a boolean'),
  
  body('phone_number')
    .optional()
    .isString().withMessage('Phone number must be a string')
    .isLength({ max: 20 }).withMessage('Phone number must be less than 20 characters'),
  
  body('additional_info')
    .optional()
    .isString().withMessage('Additional info must be a string')
    .isLength({ max: 500 }).withMessage('Additional info must be less than 500 characters')
];

// Validation for address ID
exports.addressIdValidation = [
  param('id')
    .notEmpty().withMessage('Address ID is required')
    .isInt({ min: 1 }).withMessage('Invalid address ID')
];

// Validation for setting default address
exports.setDefaultAddressValidation = [
  param('id')
    .notEmpty().withMessage('Address ID is required')
    .isInt({ min: 1 }).withMessage('Invalid address ID')
];
