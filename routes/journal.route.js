const express = require('express');
const router = express.Router();
const { 
  getJournal, 
} = require('../validators/journal.validator');
const validate = require('../middlewares/validation');

// Import controller methods individually to ensure they exist
const {
  getAllJournals,
  getJournalById,
  getAllTags,
  getAllCategories,
  checkTagsExist,
  getTagSuggestions,
  getPopularTags
} = require('../controllers/journal.controller');

// Public routes
router.get('/', getAllJournals);
router.get('/tags', getAllTags);
router.get('/tags/check', checkTagsExist);
router.get('/tags/suggestions', getTagSuggestions);
router.get('/tags/popular', getPopularTags);
router.get('/categories', getAllCategories);
router.get('/:id', ...getJournal, validate, getJournalById);

module.exports = router;
