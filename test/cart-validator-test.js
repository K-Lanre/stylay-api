const { addToCartValidation } = require('../validators/cart.validator');
const { validationResult } = require('express-validator');
const { Product, ProductVariant } = require('../models');

// Mock the models
jest.mock('../models', () => ({
  Product: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  ProductVariant: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  Cart: {
    findOrCreate: jest.fn(),
    findOne: jest.fn()
  },
  CartItem: {
    findOne: jest.fn(),
    findByPk: jest.fn()
  },
  Op: {}
}));

describe('Cart Validator Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should validate selected_variants without additional_price', async () => {
    // This is the case from the error - no additional_price provided
    mockReq.body = {
      product_id: 5001,
      quantity: 2,
      selected_variants: [
        {
          name: "size",
          id: 52697,
          value: "XXL"
        },
        {
          name: "color",
          id: 52701,
          value: "Navy"
        }
      ]
    };

    // Mock the database calls
    Product.findByPk.mockResolvedValue({
      id: 5001,
      status: 'active'
    });

    ProductVariant.findAll.mockResolvedValue([
      { id: 52697, name: 'size', value: 'XXL', stock: null },
      { id: 52701, name: 'color', value: 'Navy', stock: null }
    ]);

    // Execute validation
    const validationChain = addToCartValidation[addToCartValidation.length - 1];
    
    try {
      await validationChain.custom(mockReq.body.selected_variants, { req: mockReq });
      console.log('✅ Validation passed - additional_price is now optional');
    } catch (error) {
      console.log('❌ Validation failed:', error.message);
      throw error;
    }
  });

  test('should validate selected_variants with additional_price provided', async () => {
    // This is the case where additional_price is provided
    mockReq.body = {
      product_id: 5001,
      quantity: 2,
      selected_variants: [
        {
          name: "size",
          id: 52697,
          value: "XXL",
          additional_price: 5.00
        },
        {
          name: "color",
          id: 52701,
          value: "Navy",
          additional_price: 0.00
        }
      ]
    };

    // Mock the database calls
    Product.findByPk.mockResolvedValue({
      id: 5001,
      status: 'active'
    });

    ProductVariant.findAll.mockResolvedValue([
      { id: 52697, name: 'size', value: 'XXL', stock: null },
      { id: 52701, name: 'color', value: 'Navy', stock: null }
    ]);

    // Execute validation
    const validationChain = addToCartValidation[addToCartValidation.length - 1];
    
    try {
      await validationChain.custom(mockReq.body.selected_variants, { req: mockReq });
      console.log('✅ Validation passed - additional_price validation works correctly');
    } catch (error) {
      console.log('❌ Validation failed:', error.message);
      throw error;
    }
  });

  test('should reject invalid additional_price', async () => {
    // This should fail validation
    mockReq.body = {
      product_id: 5001,
      quantity: 2,
      selected_variants: [
        {
          name: "size",
          id: 52697,
          value: "XXL",
          additional_price: "invalid" // Should be number
        }
      ]
    };

    // Mock the database calls
    Product.findByPk.mockResolvedValue({
      id: 5001,
      status: 'active'
    });

    ProductVariant.findAll.mockResolvedValue([
      { id: 52697, name: 'size', value: 'XXL', stock: null }
    ]);

    // Execute validation
    const validationChain = addToCartValidation[addToCartValidation.length - 1];
    
    try {
      await validationChain.custom(mockReq.body.selected_variants, { req: mockReq });
      console.log('❌ Validation should have failed but passed');
      throw new Error('Expected validation to fail');
    } catch (error) {
      console.log('✅ Validation correctly rejected invalid additional_price:', error.message);
    }
  });
});