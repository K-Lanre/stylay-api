const { body, param } = require('express-validator');

// Validation for creating an address
/**
 * Validation rules for creating a new address.
 * Validates all required and optional address fields with appropriate constraints.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} label - Optional label (max 50 chars)
 * @property {ValidationChain} address_line - Required address line (max 255 chars)
 * @property {ValidationChain} city - Required city name (max 100 chars)
 * @property {ValidationChain} state - Required state name (max 100 chars)
 * @property {ValidationChain} country - Required country name (max 100 chars)
 * @property {ValidationChain} postal_code - Optional postal code (max 20 chars)
 * @property {ValidationChain} is_default - Optional boolean flag for default address
 * @property {ValidationChain} phone - Optional Nigerian phone number validation
 * @property {ValidationChain} additional_info - Optional additional information (max 500 chars)
 * @returns {Array} Express validator middleware array for address creation
 * @example
 * // Use in route:
 * router.post('/addresses', createAddressValidation, createAddress);
 */
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
  
  body('phone')
    .optional()
    .isString().withMessage('Phone number must be a string')
    .matches(/^\+234(70|80|81|90|91)[0-9]{8}$/)
    .withMessage('Phone number must be in the format +234[70|80|81|90|91]XXXXXXX (e.g., +2348012345678)'),
  
  body('additional_info')
    .optional()
    .isString().withMessage('Additional info must be a string')
    .isLength({ max: 500 }).withMessage('Additional info must be less than 500 characters')
];

// Validation for updating an address
/**
 * Validation rules for updating an existing address.
 * Validates address ID parameter and optional address fields for updates.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required address ID parameter (integer > 0)
 * @property {ValidationChain} label - Optional label update (max 50 chars)
 * @property {ValidationChain} address_line - Optional address line update (max 255 chars)
 * @property {ValidationChain} city - Optional city update (max 100 chars)
 * @property {ValidationChain} state - Optional state update (max 100 chars)
 * @property {ValidationChain} country - Optional country update (max 100 chars)
 * @property {ValidationChain} postal_code - Optional postal code update (max 20 chars)
 * @property {ValidationChain} is_default - Optional boolean flag update
 * @property {ValidationChain} phone_number - Optional Nigerian phone number update
 * @property {ValidationChain} additional_info - Optional additional info update (max 500 chars)
 * @returns {Array} Express validator middleware array for address updates
 * @example
 * // Use in route:
 * router.put('/addresses/:id', updateAddressValidation, updateAddress);
 */
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
    .matches(/^\+234(70|80|81|90|91)[0-9]{8}$/)
    .withMessage('Phone number must be in the format +234[70|80|81|90|91]XXXXXXX (e.g., +2348012345678)'),
  
  body('additional_info')
    .optional()
    .isString().withMessage('Additional info must be a string')
    .isLength({ max: 500 }).withMessage('Additional info must be less than 500 characters')
];

// Validation for address ID
/**
 * Validation rules for address ID parameter validation.
 * Ensures the provided address ID is a valid positive integer.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required address ID parameter (integer > 0)
 * @returns {Array} Express validator middleware array for address ID validation
 * @example
 * // Use in route:
 * router.get('/addresses/:id', addressIdValidation, getAddress);
 */
exports.addressIdValidation = [
  param('id')
    .notEmpty().withMessage('Address ID is required')
    .isInt({ min: 1 }).withMessage('Invalid address ID')
];

// Validation for setting default address
/**
 * Validation rules for setting an address as default.
 * Validates the address ID parameter for default address operations.
 * @type {Array<ValidationChain>} Array of express-validator validation chains
 * @property {ValidationChain} id - Required address ID parameter (integer > 0)
 * @returns {Array} Express validator middleware array for setting default address
 * @example
 * // Use in route:
 * router.patch('/addresses/:id/default', setDefaultAddressValidation, setDefaultAddress);
 */
exports.setDefaultAddressValidation = [
  param('id')
    .notEmpty().withMessage('Address ID is required')
    .isInt({ min: 1 }).withMessage('Invalid address ID')
];
