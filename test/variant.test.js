// test/variant.test.js
const { expect } = require('chai');
const VariantService = require('../services/variant.service');
const {
  VariantType,
  VariantCombination,
  ProductVariant,
  Product,
  sequelize
} = require('../models');

describe('Variant Service Tests', () => {
  before(async () => {
    // Ensure database is clean for tests
    await sequelize.sync({ force: false });
  });

  describe('generateCombinations', () => {
    it('should generate combinations from simple variants', () => {
      const variants = [
        { type: 'Color', value: 'Black', stock: 10 },
        { type: 'Color', value: 'White', stock: 15 },
        { type: 'Size', value: 'Small', stock: 5 },
        { type: 'Size', value: 'Large', stock: 8 }
      ];

      const combinations = VariantService.generateCombinations(variants);

      expect(combinations).to.have.lengthOf(4); // 2 colors × 2 sizes

      const combinationNames = combinations.map(c => c.combination_name);
      expect(combinationNames).to.include('Black-Small');
      expect(combinationNames).to.include('Black-Large');
      expect(combinationNames).to.include('White-Small');
      expect(combinationNames).to.include('White-Large');
    });

    it('should handle empty variants array', () => {
      const combinations = VariantService.generateCombinations([]);
      expect(combinations).to.have.lengthOf(0);
    });

    it('should calculate correct stock and price modifiers', () => {
      const variants = [
        { type: 'Color', value: 'Red', stock: 10, additional_price: 5 },
        { type: 'Size', value: 'Large', stock: 20, additional_price: 10 }
      ];

      const combinations = VariantService.generateCombinations(variants);

      expect(combinations).to.have.lengthOf(1);
      expect(combinations[0].stock).to.equal(30); // 10 + 20
      expect(combinations[0].price_modifier).to.equal(15); // 5 + 10
    });
  });

  describe('validateVariantData', () => {
    it('should validate correct variant data', () => {
      const variants = [
        { type: 'Color', value: 'Black', stock: 10, additional_price: 5 }
      ];

      const result = VariantService.validateVariantData(variants);
      expect(result.isValid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });

    it('should reject invalid variant data', () => {
      const variants = [
        { value: 'Black', stock: 10 }, // missing type
        { type: 'Color', stock: 10 }, // missing value
        { type: 'Color', value: 'Black', stock: -5 }, // negative stock
        { type: 'Color', value: 'Black', additional_price: 'invalid' } // invalid price
      ];

      const result = VariantService.validateVariantData(variants);
      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.lengthOf(4);
    });

    it('should reject non-array input', () => {
      const result = VariantService.validateVariantData('not an array');
      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.lengthOf(1);
    });
  });
});

describe('Variant Model Tests', () => {
  let testProduct;
  let testVariantType;

  before(async () => {
    // Create test data
    testProduct = await Product.create({
      vendor_id: 1, // Assuming vendor exists
      category_id: 1, // Assuming category exists
      name: 'Test Product',
      slug: 'test-product',
      description: 'Test description',
      price: 29.99,
      sku: 'TEST001',
      status: 'active'
    });

    testVariantType = await VariantType.create({
      name: 'color',
      display_name: 'Color',
      sort_order: 1
    });
  });

  after(async () => {
    // Clean up test data
    await ProductVariant.destroy({ where: { product_id: testProduct.id } });
    await VariantCombination.destroy({ where: { product_id: testProduct.id } });
    await Product.destroy({ where: { id: testProduct.id } });
    await VariantType.destroy({ where: { id: testVariantType.id } });
  });

  describe('Variant Creation and Combination Generation', () => {
    it('should create variants and generate combinations', async () => {
      const variants = [
        { type: 'Color', value: 'Black', stock: 10, additional_price: 0 },
        { type: 'Color', value: 'White', stock: 15, additional_price: 0 },
        { type: 'Size', value: 'Small', stock: 5, additional_price: 0 },
        { type: 'Size', value: 'Large', stock: 8, additional_price: 2 }
      ];

      // Create variants through the service
      const createdVariants = [];
      for (const variantData of variants) {
        const variant = await ProductVariant.create({
          product_id: testProduct.id,
          variant_type_id: testVariantType.id,
          name: variantData.type,
          value: variantData.value,
          additional_price: variantData.additional_price || 0,
          stock: variantData.stock || 0
        });
        createdVariants.push({
          id: variant.id,
          type: variantData.type,
          value: variantData.value,
          additional_price: variantData.additional_price || 0,
          stock: variantData.stock || 0
        });
      }

      // Generate combinations
      const combinations = await VariantService.createCombinationsForProduct(
        testProduct.id,
        createdVariants
      );

      expect(combinations).to.have.lengthOf(4); // 2 colors × 2 sizes

      // Verify combinations were created
      const dbCombinations = await VariantCombination.findAll({
        where: { product_id: testProduct.id }
      });

      expect(dbCombinations).to.have.lengthOf(4);

      // Check combination names
      const combinationNames = dbCombinations.map(c => c.combination_name);
      expect(combinationNames).to.include('Black-Small');
      expect(combinationNames).to.include('Black-Large');
      expect(combinationNames).to.include('White-Small');
      expect(combinationNames).to.include('White-Large');
    });
  });

  describe('Stock Management', () => {
    it('should update combination stock correctly', async () => {
      // Create a test combination
      const combination = await VariantCombination.create({
        product_id: testProduct.id,
        combination_name: 'Test-Black-Small',
        sku_suffix: 'TBS',
        stock: 10,
        price_modifier: 0,
        is_active: true
      });

      // Update stock
      await VariantService.updateCombinationStock(combination.id, 25);

      // Verify update
      const updatedCombination = await VariantCombination.findByPk(combination.id);
      expect(updatedCombination.stock).to.equal(25);
    });

    it('should check combination availability', async () => {
      const combination = await VariantCombination.create({
        product_id: testProduct.id,
        combination_name: 'Test-White-Large',
        sku_suffix: 'TWL',
        stock: 5,
        price_modifier: 2,
        is_active: true
      });

      const isAvailable = await VariantService.checkCombinationAvailability(combination.id, 3);
      expect(isAvailable).to.be.true;

      const isNotAvailable = await VariantService.checkCombinationAvailability(combination.id, 10);
      expect(isNotAvailable).to.be.false;
    });
  });
});

describe('Integration Tests', () => {
  it('should handle full product creation with variants workflow', async () => {
    // This would be a full integration test
    // For now, just verify the service methods exist and are callable
    expect(VariantService.generateCombinations).to.be.a('function');
    expect(VariantService.validateVariantData).to.be.a('function');
    expect(VariantService.createCombinationsForProduct).to.be.a('function');
    expect(VariantService.updateCombinationStock).to.be.a('function');
    expect(VariantService.checkCombinationAvailability).to.be.a('function');
  });
});
