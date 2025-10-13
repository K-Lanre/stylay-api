const { Review, User, Product, Order, OrderItem } = require("../models");
const AppError = require("../utils/appError");
const { Op } = require("sequelize");

/**
 * Creates a new review for a product.
 * Users can only create one review per product.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.product_id - Product ID to review
 * @param {number} req.body.rating - Rating (1-5)
 * @param {string} [req.body.comment] - Optional review comment
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with created review
 * @throws {AppError} 403 - When user has not purchased the product
 * @throws {AppError} 400 - When user has already reviewed this product
 * @throws {AppError} 404 - When product not found
 * @api {post} /api/v1/reviews Create Review
 * @private
 */
const createReview = async (req, res, next) => {
  try {
    const { product_id, rating, comment } = req.body;
    const user_id = req.user.id;

    // Check if user has purchased this product (completed orders only)
    let hasPurchased = await OrderItem.findOne({
      include: [
        {
          model: Order,
          where: {
            user_id,
            order_status: "delivered",
          },
          required: true,
        },
      ],
      where: { product_id },
    });

    if (!hasPurchased) {
      return next(
        new AppError(
          "You can only review products you have purchased. Please purchase this product first to leave a review.",
          403
        )
      );
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      where: { product_id, user_id },
    });

    if (existingReview) {
      return next(new AppError("You have already reviewed this product", 400));
    }

    // Create the review
    const review = await Review.create({
      product_id,
      user_id,
      rating,
      comment,
    });

    // Fetch the created review with associations
    const createdReview = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: Product,
          attributes: ["id", "name", "slug", "thumbnail"],
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: createdReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a paginated list of reviews with optional filtering.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {number} [req.query.product_id] - Filter by product ID
 * @param {number} [req.query.user_id] - Filter by user ID
 * @param {number} [req.query.rating] - Filter by rating
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated reviews
 * @api {get} /api/v1/reviews Get Reviews
 * @public
 */
const getReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, product_id, user_id, rating } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Apply filters
    if (product_id) whereClause.product_id = product_id;
    if (user_id) whereClause.user_id = user_id;
    if (rating) whereClause.rating = rating;

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: Product,
          attributes: ["id", "name", "slug", "thumbnail"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total: count,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a specific review by ID.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Review ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with review details
 * @throws {AppError} 404 - When review not found
 * @api {get} /api/v1/reviews/:id Get Review by ID
 * @public
 */
const getReviewById = async (req, res, next) => {
  try {
    const review = await Review.findByPk(req.params.id, {
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: Product,
          attributes: ["id", "name", "slug", "thumbnail"],
        },
      ],
    });

    if (!review) {
      return next(new AppError("Review not found", 404));
    }

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing review.
 * Only the review owner can update their review.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Review ID
 * @param {Object} req.body - Request body
 * @param {number} [req.body.rating] - Updated rating
 * @param {string} [req.body.comment] - Updated comment
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated review
 * @throws {AppError} 404 - When review not found
 * @throws {AppError} 403 - When user is not the review owner
 * @api {put} /api/v1/reviews/:id Update Review
 * @private
 */
const updateReview = async (req, res, next) => {
  try {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return next(new AppError("Review not found", 404));
    }

    // Check if user has purchased this product (completed orders only)
    hasPurchased = await OrderItem.findOne({
      include: [
        {
          model: Order,
          where: {
            user_id: req.user.id,
            order_status: "delivered",
          },
          required: true,
        },
      ],
      where: { product_id: review.product_id },
    });

    if (!hasPurchased) {
      return next(
        new AppError(
          "You can only update reviews for products you have purchased. Please purchase this product first to manage its review.",
          403
        )
      );
    }

    // Check if user has purchased this product (completed orders only)
    hasPurchased = await OrderItem.findOne({
      include: [
        {
          model: Order,
          where: {
            user_id: req.user.id,
            order_status: "delivered",
          },
          required: true,
        },
      ],
      where: { product_id: review.product_id },
    });

    if (!hasPurchased) {
      return next(
        new AppError(
          "You can only update reviews for products you have purchased. Please purchase this product first to manage its review.",
          403
        )
      );
    }

    // Check if user owns this review
    if (review.user_id !== req.user.id) {
      return next(new AppError("You can only update your own reviews", 403));
    }

    const { rating, comment } = req.body;
    const updateData = {};

    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return next(new AppError("No valid fields provided for update", 400));
    }

    await review.update(updateData);

    // Fetch updated review with associations
    const updatedReview = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "email"],
        },
        {
          model: Product,
          attributes: ["id", "name", "slug", "thumbnail"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: updatedReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a review.
 * Only the review owner can delete their review.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.id - Review ID
 * @param {Object} req.user - Authenticated user info
 * @param {number} req.user.id - User ID
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 * @throws {AppError} 404 - When review not found
 * @throws {AppError} 403 - When user is not the review owner
 * @api {delete} /api/v1/reviews/:id Delete Review
 * @private
 */
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return next(new AppError("Review not found", 404));
    }

    // Check if user has purchased this product (completed orders only)
    hasPurchased = await OrderItem.findOne({
      include: [
        {
          model: Order,
          where: {
            user_id: req.user.id,
            order_status: "delivered",
          },
          required: true,
        },
      ],
      where: { product_id: review.product_id },
    });

    if (!hasPurchased) {
      return next(
        new AppError(
          "You can only update reviews for products you have purchased. Please purchase this product first to manage its review.",
          403
        )
      );
    }

    // Check if user has purchased this product (completed orders only)
    hasPurchased = await OrderItem.findOne({
      include: [
        {
          model: Order,
          where: {
            user_id: req.user.id,
            order_status: "delivered",
          },
          required: true,
        },
      ],
      where: { product_id: review.product_id },
    });

    if (!hasPurchased) {
      return next(
        new AppError(
          "You can only update reviews for products you have purchased. Please purchase this product first to manage its review.",
          403
        )
      );
    }

    // Check if user owns this review
    if (review.user_id !== req.user.id) {
      return next(new AppError("You can only delete your own reviews", 403));
    }

    await review.destroy();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves paginated reviews for a specific product.
 * @param {import('express').Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {number} req.params.productId - Product ID
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {number} [req.query.rating] - Filter by rating
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with product reviews
 * @throws {AppError} 404 - When product not found
 * @api {get} /api/v1/products/:productId/reviews Get Reviews by Product
 * @public
 */
const getReviewsByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, rating } = req.query;
    const offset = (page - 1) * limit;

    // Check if product exists
    const product = await Product.findByPk(productId, {
      attributes: ["id", "name", "slug"],
    });

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    const whereClause = { product_id: productId };
    if (rating) whereClause.rating = rating;

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: reviews.length,
      total: count,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
      },
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getReviewsByProduct,
};
