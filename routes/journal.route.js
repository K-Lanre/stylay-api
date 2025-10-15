const express = require("express");
const router = express.Router();
const { getJournal } = require("../validators/journal.validator");
const validate = require("../middlewares/validation");

// Import controller methods individually to ensure they exist
const {
  getAllJournals,
  getJournalById,
} = require("../controllers/journal.controller");

// Public routes
router.get("/", getAllJournals);
router.get("/:id", ...getJournal, validate, getJournalById);

module.exports = router;
