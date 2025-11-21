// services/variant.service.js
const {
  VariantType,
  VariantCombination,
  VariantCombinationVariant,
  ProductVariant,
  Product,
  sequelize
} = require('../models');

/**
 * Service for managing product variants and combinations
 */
class VariantService {

  /**
   * Generate all possible combinations from product variants
   * @param {Array} variants - Array of variant objects with type and values
   * @returns {Array} Array of combination objects
   */
  static generateCombinations(variants) {
    if (!variants || variants.length === 0) {
      return [];
    }

    // Group variants by type
    const variantsByType = {};
    variants.forEach(variant => {
      if (!variantsByType[variant.type]) {
        variantsByType[variant.type] = [];
      }
      variantsByType[variant.type].push(variant);
    });

    // Generate cartesian product of all variant types
    const typeKeys = Object.keys(variantsByType);
    const combinations = this._cartesianProduct(
      typeKeys.map(type => variantsByType[type])
    );

    // Convert to combination objects
    return combinations.map((combo, index) => {
      const combinationName = combo.map(v => v.value).join('-');
      const skuSuffix = combo.map(v => v.sku_code || v.value.substring(0, 2).toUpperCase()).join('');

      return {
        combination_name: combinationName,
        sku_suffix: skuSuffix,
        stock: 0, // Stock for combination should be managed separately, not summed from individual variant values
        price_modifier: 0.00, // Price modifier for combination should be managed separately
        is_active: true,
        variants: combo
      };
    });
  }

  /**
   * Create cartesian product of arrays
   * @private
   */
  static _cartesianProduct(arrays) {
    return arrays.reduce((acc, curr) =>
      acc.flatMap(a => curr.map(b => [...a, b])), [[]]
    );
  }

  /**
   * Create variant combinations for a product
   * @param {number} productId - Product ID
   * @param {Array} variants - Array of variant data
   * @param {Object} transaction - Sequelize transaction
   * @returns {Promise<Array>} Created combinations
   */
  static async createCombinationsForProduct(productId, variants, transaction = null) {
    const combinations = this.generateCombinations(variants);

    if (combinations.length === 0) {
      return [];
    }

    const createdCombinations = [];

    for (const comboData of combinations) {
      // Create the combination
      const combination = await VariantCombination.create({
        product_id: productId,
        combination_name: comboData.combination_name,
        sku_suffix: comboData.sku_suffix,
        stock: comboData.stock,
        price_modifier: comboData.price_modifier,
        is_active: comboData.is_active
      }, { transaction });

      // Link variants to combination
      const variantLinks = comboData.variants.map(variant => ({
        combination_id: combination.id,
        variant_id: variant.id
      }));

      await VariantCombinationVariant.bulkCreate(variantLinks, { transaction });

      // Fetch the complete combination with variants
      const fullCombination = await VariantCombination.findByPk(combination.id, {
        include: [{
          model: ProductVariant,
          as: 'variants',
          attributes: ['id', 'name', 'value'],
          through: { attributes: [] }
        }],
        transaction
      });

      createdCombinations.push(fullCombination);
    }

    return createdCombinations;
  }

  /**
   * Update stock for a specific combination
   * @param {number} combinationId - Combination ID
   * @param {number} newStock - New stock level
   * @param {Object} transaction - Sequelize transaction
   * @returns {Promise<Object>} Updated combination
   */
  static async updateCombinationStock(combinationId, newStock, transaction = null) {
    const combination = await VariantCombination.findByPk(combinationId, { transaction });

    if (!combination) {
      throw new Error('Variant combination not found');
    }

    if (newStock < 0) {
      throw new Error('Stock cannot be negative');
    }

    await combination.update({ stock: newStock }, { transaction });

    return combination;
  }

  /**
   * Get available combinations for a product
   * @param {number} productId - Product ID
   * @returns {Promise<Array>} Available combinations
   */
  static async getAvailableCombinations(productId) {
    return await VariantCombination.findAll({
      where: {
        product_id: productId,
        is_active: true,
        stock: { [sequelize.Op.gt]: 0 }
      },
      include: [{
        model: ProductVariant,
        as: 'variants',
        attributes: ['id', 'name', 'value'],
        through: { attributes: [] }
      }],
      order: [['combination_name', 'ASC']]
    });
  }

  /**
   * Check if a combination is available
   * @param {number} combinationId - Combination ID
   * @param {number} requestedQuantity - Requested quantity
   * @returns {Promise<boolean>} Availability status
   */
  static async checkCombinationAvailability(combinationId, requestedQuantity = 1) {
    const combination = await VariantCombination.findByPk(combinationId, {
      attributes: ['id', 'stock', 'is_active']
    });

    if (!combination || !combination.is_active) {
      return false;
    }

    return combination.stock >= requestedQuantity;
  }

  /**
   * Reserve stock for a combination (for cart/checkout)
   * @param {number} combinationId - Combination ID
   * @param {number} quantity - Quantity to reserve
   * @param {Object} transaction - Sequelize transaction
   * @returns {Promise<boolean>} Success status
   */
  static async reserveCombinationStock(combinationId, quantity, transaction = null) {
    const combination = await VariantCombination.findByPk(combinationId, {
      attributes: ['id', 'stock'],
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined
    });

    if (!combination || combination.stock < quantity) {
      return false;
    }

    await combination.update({
      stock: combination.stock - quantity
    }, { transaction });

    return true;
  }

  /**
   * Get variant types for a product
   * @param {number} productId - Product ID
   * @returns {Promise<Array>} Variant types used by the product
   */
  static async getProductVariantTypes(productId) {
    const variantTypes = await VariantType.findAll({
      include: [{
        model: ProductVariant,
        as: 'variants',
        where: { product_id: productId },
        attributes: []
      }],
      attributes: ['id', 'name', 'display_name', 'sort_order'],
      order: [['sort_order', 'ASC']]
    });

    return variantTypes;
  }

  /**
   * Validate variant data structure
   * @param {Array} variants - Variant data to validate
   * @returns {Object} Validation result
   */
  static validateVariantData(variants) {
    const errors = [];

    if (!Array.isArray(variants)) {
      errors.push('Variants must be an array');
      return { isValid: false, errors };
    }

    variants.forEach((variant, index) => {
      if (!variant.type || typeof variant.type !== 'string') {
        errors.push(`Variant ${index}: type is required and must be a string`);
      }

      if (!variant.value || typeof variant.value !== 'string') {
        errors.push(`Variant ${index}: value is required and must be a string`);
      }
      // Removed stock and additional_price validation as these are now managed at VariantCombination level
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = VariantService;
