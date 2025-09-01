const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth');
const addressController = require('../controllers/address.controller');
const { 
  createAddressValidation, 
  updateAddressValidation, 
  addressIdValidation,
  setDefaultAddressValidation
} = require('../validators/address.validator');
const { validate } = require('../middlewares/validate');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Get all addresses for the authenticated user
router.get('/', addressController.getUserAddresses);

// Get a specific address
router.get('/:id', validate(addressIdValidation), addressController.getAddressById);

// Create a new address
router.post('/', validate(createAddressValidation), addressController.createAddress);

// Update an existing address
router.put('/:id', validate(updateAddressValidation), addressController.updateAddress);

// Delete an address
router.delete('/:id', validate(addressIdValidation), addressController.deleteAddress);

// Set default address
router.patch('/:id/default', validate(setDefaultAddressValidation), addressController.setDefaultAddress);

module.exports = router;
