const {
  Product,
  ProductVariant,
  ProductImage,
  Vendor,
  Category,
  Store,
  sequelize,
} = require("../models");
const AppError = require("../utils/appError");
const { Op } = require("sequelize");
const slugify = require("slugify");

/**
 * @desc    Create a new product
 * @route   POST /api/v1/products
 * @access  Private/Vendor
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      category_id,
      sku,
      variants = [],
      images = [],
    } = req.body;

    // Check if vendor exists and is approved
    const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
    if (!vendor) {
      return next(new AppError("Vendor account not found", 404));
    }
    if (vendor.status !== "approved") {
      return next(
        new AppError("Only approved vendors can create products", 403)
      );
    }

    // Check if category exists
    const category = await Category.findByPk(category_id);
    if (!category) {
      return next(new AppError("Category not found", 404));
    }

    // Generate unique slug from product name
    let slug = slugify(name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });

    // Check if slug already exists and make it unique if needed
    const slugCount = await Product.count({
      where: { slug: { [Op.like]: `${slug}%` } },
    });
    if (slugCount > 0) {
      const randomString = Math.random().toString(36).substring(2, 8);
      slug = `${slug}-${randomString}`;
    }

    // Create the product with the vendor's ID (not user ID)
    const product = await Product.create({
      vendor_id: vendor.id, // Use the vendor's ID from the vendors table
      category_id,
      name,
      slug,
      description,
      price,
      sku,
      status: "active",
      impressions: 0,
      sold_units: 0,
    });

    // Add variants if any
    if (variants && variants.length > 0) {
      await ProductVariant.bulkCreate(
        variants.map((variant) => ({
          ...variant,
          product_id: product.id,
        }))
      );
    }

    // Add images if any
    if (images && images.length > 0) {
      await ProductImage.bulkCreate(
        images.map((image, index) => ({
          product_id: product.id,
          image_url: image.url,
          is_featured: index === 0, // First image is featured by default
        }))
      );
    }

    // Fetch the created product with associations
    const createdProduct = await Product.findByPk(product.id, {
      include: [
        { model: ProductVariant },
        { model: ProductImage, as: 'productImages' },
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id", "status"],
          as: "vendor",
          include: [
            {
              model: Store,
              as: "store",
              attributes: ["id", "business_name"],
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: createdProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all products
 * @route   GET /api/v1/products
 * @access  Public
 */
const getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit =12, category, vendor, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Filter by category
    if (category) {
      whereClause.category_id = category;
    }

    // Filter by vendor
    if (vendor) {
      whereClause.vendor_id = vendor;
    }

    // Search by product name or description
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id"],
          as: "vendor",
        },
        { model: ProductImage, limit: 1, as: 'images' }, // Only get first image for listing
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product
 * @route   GET /api/v1/products/:id
 * @access  Public
 */
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id", "status"],
          as: "vendor",
          include: [
            {
              model: Store,
              as: "store",
              attributes: ["business_name"],
            },
          ],
        },
        { model: ProductVariant },
        { model: ProductImage, as: "images" },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Increment impression count for analytics
    await Product.increment('impressions', {
      by: 1,
      where: { id: req.params.id }
    });

    // Track unique viewers (simplified - in production, use sessions/cookies)
    // For now, we'll increment viewers on each view, but you could implement
    // more sophisticated tracking based on user sessions
    const userId = req.user?.id;
    if (userId) {
      // Optional: Implement unique viewer tracking logic here
      // This could involve a separate table to track user-product views
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product
 * @route   PUT /api/v1/products/:id
 * @access  Private/Vendor
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }
    // For admins, skip ownership check but still verify the product exists
    const isAdmin = req.user.roles && req.user.roles.some(role => role.name === 'admin');
    
    if (isAdmin) {
      // Just verify the vendor exists and is approved
      const vendor = await Vendor.findByPk(product.vendor_id, {
        attributes: ["id", "status"],
        as: "vendor",
      });

      if (!vendor) {
        return next(new AppError("Product vendor not found", 404));
      }

      if (vendor.status !== "approved") {
        return next(new AppError("Product vendor is not approved", 403));
      }

      // Continue with the update for admin
      next();
      return;
    }

    // For vendors, verify ownership and status
    const vendor = await Vendor.findOne({
      where: {
        user_id: req.user.id,
        id: product.vendor_id,
      },
      attributes: ["id", "status"],
      as: "vendor",
    });

    if (!vendor) {
      return next(new AppError("Not authorized to update this product", 403));
    }

    if (vendor.status !== "approved") {
      return next(new AppError("Your vendor account is not approved", 403));
    }

    // Prepare update data
    const updateData = {};
    const { name, description, price, category_id, sku, status } =
      req.body;

    // Handle category update
    if (category_id) {
      const category = await Category.findByPk(category_id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }
      updateData.category_id = category_id;
    }

    // Handle name and slug update
    if (name && name !== product.name) {
      updateData.name = name;

      // Generate new slug
      let slug = slugify(name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });

      // Append a unique identifier if slug already exists
      const existingProduct = await Product.findOne({
        where: {
          slug,
          id: { [Op.ne]: product.id }, // Exclude current product
        },
      });

      if (existingProduct) {
        slug = `${slug}-${Date.now()}`;
      }

      updateData.slug = slug;
    }

    // Add other fields to update
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (sku !== undefined) updateData.sku = sku;
    if (status !== undefined) updateData.status = status;

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return next(new AppError("No valid fields provided for update", 400));
    }

    // Update the product
    await product.update(updateData);

    // Fetch the updated product with associations
    const updatedProduct = await Product.findByPk(product.id, {
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id"],
          as: "vendor",
          include: [{
            model: Store,
            as: 'store',
            attributes: ["id", "business_name"]
          }]
        },
        { model: ProductVariant },
        { model: ProductImage, as: 'productImages' },
      ],
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/v1/products/:id
 * @access  Private/Vendor
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Check if the current user is the product owner or admin
    if (product.vendor_id !== req.user.id && req.user.role !== "admin") {
      return next(new AppError("Not authorized to delete this product", 403));
    }

    await product.destroy();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get products by vendor
 * @route   GET /api/v1/vendors/:id/products
 * @access  Public
 */
const getVendorProducts = async (req, res, next) => {
  try {
    const { page = 1, limit =12 } = req.query;
    const offset = (page - 1) * limit;

    const vendor = await Vendor.findByPk(req.params.id);

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: { vendor_id: req.params.id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        { model: ProductImage, limit: 1 , as: "images"}, // Only get first image for listing
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all products (Admin)
 * @route   GET /api/v1/products/admin/all
 * @access  Private/Admin
 */
const getAllProducts = async (req, res, next) => {
  try {
    const { page = 1, limit =12, search, category, vendor } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Apply filters if provided
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
      ];
    }

    if (category) whereClause.category_id = category;
    if (vendor) whereClause.vendor_id = vendor;

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        { model: Vendor, attributes: ["id", "business_name", "status"], as: "vendor" },
        { model: ProductImage, limit: 1, as: "images" },
        { model: ProductVariant },
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update any product (Admin)
 * @route   PUT /api/v1/products/admin/:id
 * @access  Private/Admin
 */
const adminUpdateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Category, attributes: ["id", "name"] },
        { model: Vendor, attributes: ["id", "business_name"], as: "vendor" },
        { model: ProductVariant },
        { model: ProductImage, as: "images" },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Update product fields
    const { name, description, price, category_id, sku, status } =
      req.body;

    if (category_id) {
      const category = await Category.findByPk(category_id);
      if (!category) {
        return next(new AppError("Category not found", 404));
      }
    }

    // Generate new slug if name is being updated
    let slug = product.slug;
    if (name && name !== product.name) {
      slug = slugify(name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });

      // Check if slug already exists for another product
      const existingProduct = await Product.findOne({ where: { slug } });
      if (existingProduct && existingProduct.id !== product.id) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    await product.update({
      name: name || product.name,
      slug,
      description: description || product.description,
      price: price || product.price,
      category_id: category_id || product.category_id,
      sku: sku || product.sku,
      status: status || product.status,
    });

    // Fetch the updated product with associations
    const updatedProduct = await Product.findByPk(product.id, {
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id"],
          as: "vendor",
          include: [{
            model: Store,
            as: 'store',
            attributes: ["id", "business_name"]
          }]
        },
        { model: ProductVariant },
        { model: ProductImage, as: "images" },
      ],
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete any product (Admin)
 * @route   DELETE /api/v1/products/admin/:id
 * @access  Private/Admin
 */
const adminDeleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    await product.destroy();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product status (Admin)
 * @route   PATCH /api/v1/products/admin/:id/status
 * @access  Private/Admin
 */
const updateProductStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Vendor, attributes: ["id", "business_name"], as: "vendor" },
        { model: Category, attributes: ["id", "name"] },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    await product.update({ status });

    res.status(200).json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        status: product.status,
        vendor: product.Vendor,
        category: product.Category,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get products by status (Admin)
 * @route   GET /api/v1/products/admin/status/:status
 * @access  Private/Admin
 */
const getProductsByStatus = async (req, res, next) => {
  try {
    const { status } = req.params;
    const { page = 1, limit =12 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    // Only filter by status if not 'all'
    if (status !== "all") {
      whereClause.status = status;
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        { model: Vendor, attributes: ["id", "business_name", "status"], as: "vendor" },
        { model: ProductImage, limit: 1 , as: "images"},
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get product analytics/metrics
 * @route   GET /api/v1/products/:id/analytics
 * @access  Private (Vendor/Admin)
 */
const getProductAnalytics = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const isAdmin = req.user.roles && req.user.roles.some(role => role.name === 'admin');

    // Find the product
    const product = await Product.findByPk(productId, {
      include: [
        { model: Vendor, attributes: ["id", "user_id"], as: "vendor" },
        { model: Category, attributes: ["id", "name"] },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Check if user owns this product or is admin
    if (!isAdmin && product.vendor.user_id !== req.user.id) {
      return next(new AppError("Not authorized to view this product's analytics", 403));
    }

    // Get order statistics for this product
    const orderStats = await sequelize.query(`
      SELECT
        COUNT(DISTINCT oi.order_id) as total_orders,
        SUM(oi.quantity) as total_units_sold,
        AVG(oi.price) as average_sale_price,
        SUM(oi.sub_total) as total_revenue,
        MIN(o.order_date) as first_sale_date,
        MAX(o.order_date) as last_sale_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = :productId
      AND o.payment_status = 'paid'
      AND o.order_status IN ('processing', 'shipped', 'delivered')
    `, {
      replacements: { productId },
      type: sequelize.QueryTypes.SELECT,
    });

    // Get monthly sales data for the last 12 months
    const monthlySales = await sequelize.query(`
      SELECT
        DATE_FORMAT(o.order_date, '%Y-%m') as month,
        COUNT(DISTINCT oi.order_id) as orders_count,
        SUM(oi.quantity) as units_sold,
        SUM(oi.sub_total) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = :productId
      AND o.payment_status = 'paid'
      AND o.order_status IN ('processing', 'shipped', 'delivered')
      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
      ORDER BY month DESC
    `, {
      replacements: { productId },
      type: sequelize.QueryTypes.SELECT,
    });

    // Calculate conversion rate (orders per impression)
    const stats = orderStats[0] || {};
    const conversionRate = stats.total_orders && product.impressions
      ? (stats.total_orders / product.impressions) * 100
      : 0;

    // Calculate average order value for this product
    const avgOrderValue = stats.total_revenue && stats.total_orders
      ? stats.total_revenue / stats.total_orders
      : 0;

    res.status(200).json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          impressions: product.impressions,
          sold_units: product.sold_units,
          status: product.status,
        },
        analytics: {
          total_orders: parseInt(stats.total_orders) || 0,
          total_units_sold: parseInt(stats.total_units_sold) || 0,
          total_revenue: parseFloat(stats.total_revenue) || 0,
          average_sale_price: parseFloat(stats.average_sale_price) || 0,
          average_order_value: parseFloat(avgOrderValue),
          conversion_rate: parseFloat(conversionRate.toFixed(2)),
          first_sale_date: stats.first_sale_date,
          last_sale_date: stats.last_sale_date,
          monthly_sales: monthlySales,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get vendor's products analytics summary
 * @route   GET /api/v1/products/vendor/analytics
 * @access  Private (Vendor)
 */
const getVendorAnalytics = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
    if (!vendor) {
      return next(new AppError("Vendor account not found", 404));
    }

    // Get overall vendor analytics
    const vendorStats = await sequelize.query(`
      SELECT
        COUNT(DISTINCT p.id) as total_products,
        SUM(p.impressions) as total_impressions,
        SUM(p.sold_units) as total_sold_units,
        COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_products,
        AVG(p.impressions) as avg_impressions_per_product,
        AVG(p.sold_units) as avg_sales_per_product
      FROM products p
      WHERE p.vendor_id = :vendorId
    `, {
      replacements: { vendorId: vendor.id },
      type: sequelize.QueryTypes.SELECT,
    });

    // Get top performing products
    const topProducts = await sequelize.query(`
      SELECT
        p.id,
        p.name,
        p.impressions,
        p.sold_units,
        COALESCE(SUM(oi.sub_total), 0) as total_revenue,
        COALESCE(COUNT(DISTINCT oi.order_id), 0) as total_orders
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'paid'
      WHERE p.vendor_id = :vendorId
      GROUP BY p.id, p.name, p.impressions, p.sold_units
      ORDER BY total_revenue DESC
      LIMIT 10
    `, {
      replacements: { vendorId: vendor.id },
      type: sequelize.QueryTypes.SELECT,
    });

    const stats = vendorStats[0] || {};

    res.status(200).json({
      success: true,
      data: {
        summary: {
          total_products: parseInt(stats.total_products) || 0,
          active_products: parseInt(stats.active_products) || 0,
          total_impressions: parseInt(stats.total_impressions) || 0,
          total_sold_units: parseInt(stats.total_sold_units) || 0,
          avg_impressions_per_product: parseFloat(stats.avg_impressions_per_product) || 0,
          avg_sales_per_product: parseFloat(stats.avg_sales_per_product) || 0,
        },
        top_products: topProducts.map(product => ({
          id: product.id,
          name: product.name,
          impressions: parseInt(product.impressions) || 0,
          sold_units: parseInt(product.sold_units) || 0,
          total_revenue: parseFloat(product.total_revenue) || 0,
          total_orders: parseInt(product.total_orders) || 0,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  getProductAnalytics,
  getVendorAnalytics,
  // Admin methods
  getAllProducts,
  adminUpdateProduct,
  adminDeleteProduct,
  updateProductStatus,
  getProductsByStatus,
};
