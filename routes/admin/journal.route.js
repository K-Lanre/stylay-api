const express = require('express');
const router = express.Router();
const {
  createJournal,
  updateJournal,
} = require('../../validators/journal.validator');
const { protect, restrictTo } = require('../../middlewares/auth');
const validate = require('../../middlewares/validation');
const { uploadJournalImages } = require('../../middlewares/fileUpload');

// Import controller methods individually to ensure they exist
const {
  createJournal: createJournalHandler,
  updateJournal: updateJournalHandler,
  deleteJournal: deleteJournalHandler,
} = require('../../controllers/journal.controller');

// Protected Admin routes
router.use(protect);
router.use(restrictTo('admin'));

router.post(
  '/',
  uploadJournalImages('featured_images', 10), // Support up to 10 featured images
  ...createJournal,
  validate,
  createJournalHandler
);

router.put(
  '/:id',
  uploadJournalImages('featured_images', 10), // Support up to 10 featured images
  ...updateJournal,
  validate,
  updateJournalHandler
);

router.delete(
  '/:id',
  deleteJournalHandler
);

module.exports = router;
