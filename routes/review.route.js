const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { protect } = require('../middlewares/auth');
const {
  createReviewValidation,
  updateReviewValidation,
  listReviewsValidation,
  reviewIdValidation
} = require('../validators/review.validator');

// Public routes
/**
 * @desc    Get all reviews with optional filtering
 * @route   GET /api/v1/reviews
 * @access  Public
 */
router.get('/', listReviewsValidation, reviewController.getReviews);

/**
 * @desc    Get a specific review by ID
 * @route   GET /api/v1/reviews/:id
 * @access  Public
 */
router.get('/:id', reviewIdValidation, reviewController.getReviewById);

// Protected routes (require authentication)
router.use(protect);

/**
 * @desc    Create a new review
 * @route   POST /api/v1/reviews
 * @access  Private (Authenticated users)
 */
router.post('/', createReviewValidation, reviewController.createReview);

/**
 * @desc    Update a review
 * @route   PUT /api/v1/reviews/:id
 * @access  Private (Review owner only)
 */
router.put('/:id', reviewIdValidation, updateReviewValidation, reviewController.updateReview);

/**
 * @desc    Delete a review
 * @route   DELETE /api/v1/reviews/:id
 * @access  Private (Review owner only)
 */
router.delete('/:id', reviewIdValidation, reviewController.deleteReview);

module.exports = router;