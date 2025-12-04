// services/filter.service.js
'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Category, Product, ProductVariant, VariantType, VariantCombination, ProductImage } = require('../models');

class FilterService {
  constructor() {
    this.Category = Category;
    this.Product = Product;
    this.ProductVariant = ProductVariant;
    this.VariantType = VariantType;
    this.VariantCombination = VariantCombination;
    this.ProductImage = ProductImage;
    this.sequelize = sequelize;
  }

  /**
   * Get all categories (top-level only)
   */
  async getCategories() {
    try {
      const categories = await this.Category.findAll({
        where: { parent_id: null },
        attributes: ['id', 'name', 'slug'],
        order: [['name', 'ASC']],
        raw: true
      });

      return categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug
      }));
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Get price range from active products
   */
  async getPriceRange(categoryId = null) {
    try {
      const where = { status: 'active' };
      if (categoryId) {
        where.category_id = categoryId;
      }

      const priceData = await this.Product.findAll({
        attributes: [
          [this.sequelize.fn('MIN', this.sequelize.col('price')), 'min_price'],
          [this.sequelize.fn('MAX', this.sequelize.col('price')), 'max_price']
        ],
        where,
        raw: true
      });

      const minPrice = Math.floor(priceData[0]?.min_price || 0);
      const maxPrice = Math.ceil(priceData[0]?.max_price || 1000);

      return {
        min: minPrice,
        max: maxPrice,
        currency: 'USD'
      };
    } catch (error) {
      console.error('Error fetching price range:', error);
      throw error;
    }
  }

  /**
   * Get all available colors with product counts
   */
  async getColors(categoryId = null) {
    try {
      const where = { status: 'active' };
      if (categoryId) {
        where.category_id = categoryId;
      }

      const colors = await this.ProductVariant.findAll({
        attributes: [
          'value',
          [this.sequelize.fn('COUNT', this.sequelize.col('ProductVariant.id')), 'count']
        ],
        include: [
          {
            model: this.VariantType,
            as: 'variantType',
            attributes: [],
            where: { name: 'color' },
            required: true
          },
          {
            model: this.Product,
            attributes: [],
            where,
            required: true
          }
        ],
        group: ['ProductVariant.value'],
        raw: true,
        subQuery: false,
        order: [[this.sequelize.col('count'), 'DESC']]
      });

      return colors.map(c => ({
        value: c.value,
        label: this.capitalizeFirst(c.value),
        count: parseInt(c.count) || 0
      }));
    } catch (error) {
      console.error('Error fetching colors:', error);
      throw error;
    }
  }

  /**
   * Get all available sizes with product counts
   */
  async getSizes(categoryId = null) {
    try {
      const sizeOrder = [
        'XX-Small',
        'X-Small',
        'Small',
        'Medium',
        'Large',
        'X-Large',
        'XX-Large',
        '3X-Large',
        '4X-Large'
      ];

      const where = { status: 'active' };
      if (categoryId) {
        where.category_id = categoryId;
      }

      const sizes = await this.ProductVariant.findAll({
        attributes: [
          'value',
          [this.sequelize.fn('COUNT', this.sequelize.col('ProductVariant.id')), 'count']
        ],
        include: [
          {
            model: this.VariantType,
            as: 'variantType',
            attributes: [],
            where: { name: 'size' },
            required: true
          },
          {
            model: this.Product,
            attributes: [],
            where,
            required: true
          }
        ],
        group: ['ProductVariant.value'],
        raw: true,
        subQuery: false
      });

      // Sort by predefined order
      sizes.sort((a, b) => sizeOrder.indexOf(a.value) - sizeOrder.indexOf(b.value));

      return sizes.map(s => ({
        value: s.value,
        label: s.value,
        count: parseInt(s.count) || 0
      }));
    } catch (error) {
      console.error('Error fetching sizes:', error);
      throw error;
    }
  }

  /**
   * Get dress styles (from child categories)
   */
  async getDressStyles(categoryId = null) {
    try {
      const where = { parent_id: 6 }; // Assuming 6 is "Dress Style" parent
      const productWhere = { status: 'active' };
      if (categoryId) {
        productWhere.category_id = categoryId;
      }

      const dressStyles = await this.Category.findAll({
        where,
        attributes: [
          'id',
          'name',
          'slug',
          [
            this.sequelize.fn('COUNT', this.sequelize.col('Products.id')),
            'product_count'
          ]
        ],
        include: [
          {
            model: this.Product,
            attributes: [],
            where: productWhere,
            required: false
          }
        ],
        group: ['Category.id'],
        order: [['name', 'ASC']],
        raw: true,
        subQuery: false
      });

      return dressStyles.map(d => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        count: parseInt(d.product_count) || 0
      }));
    } catch (error) {
      console.error('Error fetching dress styles:', error);
      throw error;
    }
  }

  /**
   * Get all sidebar filter data
   */
  async getAllFilterData(categorySlug = null) {
    try {
      let categoryId = null;

      // Get category ID if filtering by category slug
      if (categorySlug) {
        const category = await this.Category.findOne({
          where: { slug: categorySlug },
          attributes: ['id'],
          raw: true
        });
        if (category) {
          categoryId = category.id;
        }
      }

      // Execute all queries in parallel
      const [categories, priceRange, colors, sizes, dressStyles] = await Promise.all([
        this.getCategories(),
        this.getPriceRange(categoryId),
        this.getColors(categoryId),
        this.getSizes(categoryId),
        this.getDressStyles(categoryId)
      ]);

      return {
        success: true,
        data: {
          categories,
          priceRange,
          colors,
          sizes,
          dressStyles
        }
      };
    } catch (error) {
      console.error('Error fetching all filter data:', error);
      throw error;
    }
  }

  /**
   * Get filtered products based on selected filters
   */
  async getFilteredProducts(filters = {}, pagination = {}) {
    try {
      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || 20;
      const offset = (page - 1) * limit;

      const where = { status: 'active' };
      const include = [];

      // Category filter
      if (filters.categoryId) {
        where.category_id = filters.categoryId;
      }

      // Price range filter
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        where.price = {};
        if (filters.minPrice !== undefined) {
          where.price[Op.gte] = parseFloat(filters.minPrice);
        }
        if (filters.maxPrice !== undefined) {
          where.price[Op.lte] = parseFloat(filters.maxPrice);
        }
      }

      // Color filter
      if (filters.colors && Array.isArray(filters.colors) && filters.colors.length > 0) {
        include.push({
          model: this.ProductVariant,
          as: 'variants',
          attributes: ['id', 'name', 'value'],
          where: {
            value: { [Op.in]: filters.colors }
          },
          include: [
            {
              model: this.VariantType,
              as: 'variantType',
              attributes: [],
              where: { name: 'color' },
              required: true
            }
          ],
          required: true,
          duplicating: false
        });
      }

      // Size filter
      if (filters.sizes && Array.isArray(filters.sizes) && filters.sizes.length > 0) {
        include.push({
          model: this.ProductVariant,
          as: 'variants',
          attributes: ['id', 'name', 'value'],
          where: {
            value: { [Op.in]: filters.sizes }
          },
          include: [
            {
              model: this.VariantType,
              as: 'variantType',
              attributes: [],
              where: { name: 'size' },
              required: true
            }
          ],
          required: true,
          duplicating: false
        });
      }

      // Add default includes
      include.push({
        model: this.Category,
        attributes: ['id', 'name', 'slug']
      });

      include.push({
        model: this.ProductImage,
        as: 'images',
        attributes: ['image_url', 'is_featured'],
        required: false
      });

      const { rows, count } = await this.Product.findAndCountAll({
        where,
        include,
        distinct: true,
        subQuery: false,
        limit,
        offset,
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        data: rows,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching filtered products:', error);
      throw error;
    }
  }

  /**
   * Get variant combinations for a product
   */
  async getProductCombinations(productId) {
    try {
      const product = await this.Product.findByPk(productId, {
        include: [
          {
            model: this.VariantCombination,
            as: 'combinations',
            attributes: [
              'id',
              'combination_name',
              'sku_suffix',
              'stock',
              'price_modifier',
              'is_active'
            ],
            include: [
              {
                model: this.ProductVariant,
                as: 'variants',
                attributes: ['id', 'name', 'value'],
                through: { attributes: [] }
              }
            ]
          }
        ]
      });

      if (!product) {
        return { success: false, message: 'Product not found' };
      }

      return {
        success: true,
        data: {
          productId: product.id,
          productName: product.name,
          basePrice: product.price,
          combinations: product.combinations.map(combo => ({
            id: combo.id,
            name: combo.combination_name,
            skuSuffix: combo.sku_suffix,
            stock: combo.stock,
            priceModifier: combo.price_modifier,
            totalPrice: parseFloat(product.price) + parseFloat(combo.price_modifier),
            isActive: combo.is_active,
            variants: combo.variants.map(v => ({
              id: v.id,
              name: v.name,
              value: v.value
            }))
          }))
        }
      };
    } catch (error) {
      console.error('Error fetching variant combinations:', error);
      throw error;
    }
  }

  /**
   * Helper function to capitalize first letter
   */
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

module.exports = FilterService;
