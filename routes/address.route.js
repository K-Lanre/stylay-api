const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const addressController = require('../controllers/address.controller');
const { 
  createAddressValidation, 
  updateAddressValidation, 
  addressIdValidation,
  setDefaultAddressValidation
} = require('../validators/address.validator');
const  validate  = require('../middlewares/validation');

// Apply authentication middleware to all routes
router.use(protect);

// Get all addresses for the authenticated user
router.get('/', addressController.getUserAddresses);

// Get a specific address
router.get('/:id',addressIdValidation, validate, addressController.getAddressById);

// Create a new address
router.post('/',createAddressValidation, validate, addressController.createAddress);

// Update an existing address
router.put('/:id',updateAddressValidation, validate, addressController.updateAddress);

// Delete an address
router.delete('/:id',addressIdValidation, validate, addressController.deleteAddress);

// Set default address
router.patch('/:id/default',setDefaultAddressValidation, validate, addressController.setDefaultAddress);

module.exports = router;
