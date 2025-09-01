const express = require("express");
const router = express.Router();
const {
  createJournal,
  updateJournal,
  getJournal,
  deleteJournal,
} = require("../validators/journal.validator");
const { protect, restrictTo } = require("../middlewares/auth");
const validate = require("../middlewares/validation");

// Import controller methods individually to ensure they exist
const {
  createJournal: createJournalHandler,
  getAllJournals,
  getJournalById,
  updateJournal: updateJournalHandler,
  deleteJournal: deleteJournalHandler,
} = require("../controllers/journal.controller");

// Public routes
router.get("/", getAllJournals);
router.get("/:id", ...getJournal, validate, getJournalById);

// Protected Admin routes
router.use(protect);
router.use(restrictTo("admin"));
router.post(
  "/",
  ...createJournal,
  validate,
  createJournalHandler
);

router.put(
  "/:id",
  ...updateJournal,
  validate,
  updateJournalHandler
);

router.delete(
  "/:id",
  ...deleteJournal,
  validate,
  deleteJournalHandler
);

module.exports = router;
