const { isVendor } = require("../middlewares/auth");
const {
  Product,
  ProductVariant,
  ProductImage,
  Vendor,
  Category,
  Store,
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
      stock,
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
      stock,
      status: "active",
      impressions: 0,
      viewers: 0,
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
        { model: ProductImage },
        { model: Category, attributes: ["id", "name", "slug"] },
        {
          model: Vendor,
          attributes: ["id", "status"],
          include: [
            {
              model: Store,
              as: "Store",
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
    const { page = 1, limit = 10, category, vendor, search } = req.query;
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
        },
        { model: ProductImage, limit: 1 }, // Only get first image for listing
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
          include: [
            {
              model: Store,
              attributes: ["business_name"],
            },
          ],
        },
        { model: ProductVariant },
        { model: ProductImage },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
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
    });

    if (!vendor) {
      return next(new AppError("Not authorized to update this product", 403));
    }

    if (vendor.status !== "approved") {
      return next(new AppError("Your vendor account is not approved", 403));
    }

    // Prepare update data
    const updateData = {};
    const { name, description, price, category_id, sku, stock, status } =
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
    if (stock !== undefined) updateData.stock = stock;
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
          include: [{
            model: Store,
            as: 'Store',
            attributes: ["id", "business_name"]
          }]
        },
        { model: ProductVariant },
        { model: ProductImage },
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
    const { page = 1, limit = 10 } = req.query;
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
        { model: ProductImage, limit: 1 }, // Only get first image for listing
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
    const { page = 1, limit = 10, search, category, vendor } = req.query;
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
        { model: Vendor, attributes: ["id", "business_name", "status"] },
        { model: ProductImage, limit: 1 },
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
        { model: Vendor, attributes: ["id", "business_name"] },
        { model: ProductVariant },
        { model: ProductImage },
      ],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    // Update product fields
    const { name, description, price, category_id, sku, stock, status } =
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
      stock: stock !== undefined ? stock : product.stock,
      status: status || product.status,
    });

    // Fetch the updated product with associations
    const updatedProduct = await Product.findByPk(product.id, {
      include: [
        { model: Category, attributes: ["id", "name", "slug"] },
        { 
          model: Vendor, 
          attributes: ["id"],
          include: [{
            model: Store,
            as: 'Store',
            attributes: ["id", "business_name"]
          }]
        },
        { model: ProductVariant },
        { model: ProductImage },
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
        { model: Vendor, attributes: ["id", "business_name"] },
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
    const { page = 1, limit = 10 } = req.query;
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
        { model: Vendor, attributes: ["id", "business_name", "status"] },
        { model: ProductImage, limit: 1 },
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

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  // Admin methods
  getAllProducts,
  adminUpdateProduct,
  adminDeleteProduct,
  updateProductStatus,
  getProductsByStatus,
};
