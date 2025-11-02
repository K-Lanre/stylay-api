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
const { can } = require('../middlewares/permission');

// Apply authentication middleware to all routes
router.use(protect);

// Get all addresses for the authenticated user
router.get('/', can('addresses', 'read'), addressController.getUserAddresses);

// Get a specific address
router.get('/:id',addressIdValidation, validate, can('addresses', 'read'), addressController.getAddressById);

// Create a new address
router.post('/',createAddressValidation, validate, can('addresses', 'create'), addressController.createAddress);

// Update an existing address
router.put('/:id',updateAddressValidation, validate, can('addresses', 'update'), addressController.updateAddress);

// Delete an address
router.delete('/:id',addressIdValidation, validate, can('addresses', 'delete'), addressController.deleteAddress);

// Set default address
router.patch('/:id/default',setDefaultAddressValidation, validate, can('addresses', 'update'), addressController.setDefaultAddress);

module.exports = router;
