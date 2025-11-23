const express = require("express");
const router = express.Router();

const supportFeedbackController = require("../controllers/support-feedback.controller");
const {
  createFeedbackValidator,
  getFeedbackValidator,
  updateFeedbackValidator,
  validate
} = require("../validators/support-feedback.validator");
const { protect } = require("../middlewares/auth");
const uploadSupportFiles = require("../middlewares/supportFileUpload");

router.use(protect);

router
  .route("/")
  .post(
    uploadSupportFiles("attachments", 5, "support-attachments"),
    createFeedbackValidator,
    validate,
    supportFeedbackController.createFeedback
  )
  .get(supportFeedbackController.getMyFeedbacks);

router
  .route("/:id")
  .get(getFeedbackValidator, validate, supportFeedbackController.getFeedback)
  .patch(updateFeedbackValidator, validate, supportFeedbackController.updateFeedbackStatus)
  .delete(supportFeedbackController.deleteFeedback);

module.exports = router;