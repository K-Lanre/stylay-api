const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { SupportFeedback, User, sequelize } = require('../models');
const path = require('path');
const fs = require('fs');
const { sendSupportFeedbackConfirmation } = require('../services/email.service');


exports.createFeedback = catchAsync(async (req, res) => {
  const {
    subject,
    order_number,
    issue_type,
    description,
    preferred_support_method,
    contact_email,
    contact_phone
  } = req.body;

  const userId = req.user.id;

  // Generate unique reference number
  let referenceNumber;
  let attempt = 0;
  do {
    referenceNumber = `SF-${uuidv4().slice(0, 8).toUpperCase()}`;
    attempt++;
  } while (await SupportFeedback.findOne({ where: { reference_number: referenceNumber } }) && attempt < 5);

  if (attempt >= 5) {
    throw new AppError('Could not generate unique reference number', 500);
  }

  const uploadedFiles = req.uploadedFiles || [];
  const attachments = uploadedFiles.map(file => ({
    filename: file.filename,
    url: file.url,
    mimetype: file.mimetype,
    size: file.size
  }));

  const feedback = await sequelize.transaction(async (t) => {
    return SupportFeedback.create({
      user_id: userId,
      subject,
      order_number,
      issue_type,
      description,
      preferred_support_method,
      contact_email,
      contact_phone,
      attachments,
      reference_number: referenceNumber
    }, { transaction: t });
  });

  // Send confirmation email
  const user = await User.findByPk(userId, { attributes: ['email', 'first_name', 'last_name'] });
  await sendSupportFeedbackConfirmation(user.email, {
    support: feedback,
    user: user.toJSON(),
    referenceNumber
  });

  logger.info(`Support feedback created - ID: ${feedback.id}, User: ${userId}, Ref: ${referenceNumber}`);

  res.status(201).json({
    success: true,
    data: {
      id: feedback.id,
      reference_number: feedback.reference_number,
      status: feedback.status
    }
  });
});

exports.getMyFeedbacks = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status } = req.query;

  const offset = (page - 1) * limit;
  const where = { user_id: userId };
  if (status) where.status = status;

  const { count, rows } = await SupportFeedback.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    include: [{
      model: User,
      as: 'User',
      attributes: ['first_name', 'last_name', 'email']
    }]
  });

  res.json({
    success: true,
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / limit)
    }
  });
});

exports.getFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;
  const feedback = await SupportFeedback.findByPk(id, {
    include: [{
      model: User,
      as: 'User',
      attributes: ['first_name', 'last_name', 'email']
    }]
  });

  if (!feedback) {
    throw new AppError('Feedback not found', 404);
  }

  // Check permission - owner or admin
  logger.info('deleteFeedback auth', {
    userId: req.user.id,
    isAdmin: req.user.roles.some((role) => role.name === "admin"),
    userRoles: req.user.roles,
    feedbackUserId: feedback.user_id
  });
  // Owner or admin only
  if (feedback.user_id !== req.user.id && !req.user.roles.some(role => role.name === 'admin')) {
    throw new AppError('Unauthorized', 403);
  }

  res.json({
    success: true,
    data: feedback
  });
});

exports.updateFeedbackStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;


  const feedback = await sequelize.transaction(async (t) => {
    const fb = await SupportFeedback.findByPk(id, { transaction: t });
    if (!fb) {
      throw new AppError('Feedback not found', 404);
    }
    fb.status = status;
    await fb.save({ transaction: t });
    return fb;
  });

  logger.info('updateFeedbackStatus auth', {
    userId: req.user.id,
    isAdmin: req.user.roles.some((role) => role.name === "admin"),
    userRoles: req.user.roles
  });
  // Admin only
  if (!req.user.roles.some((role) => role.name === "admin")) {
    throw new AppError('Admin access required', 403);
  }


  logger.info(`Feedback status updated - ID: ${id}, Status: ${status}`);

  res.json({
    success: true,
    data: feedback
  });
});

exports.deleteFeedback = catchAsync(async (req, res) => {
  const { id } = req.params;

  const feedback = await sequelize.transaction(async (t) => {
    const fb = await SupportFeedback.findByPk(id, { transaction: t });
    if (!fb) {
      throw new AppError('Feedback not found', 404);
    }
    if (fb.user_id !== req.user.id && !req.user.roles.some(role => role.name === 'admin')) {
      throw new AppError('Unauthorized', 403);
    }
    // Delete attachments files
    if (fb.attachments && Array.isArray(fb.attachments)) {
      fb.attachments.forEach(att => {
        const filepath = path.join(process.cwd(), 'public/Upload/support-attachments', att.filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      });
    }
    await fb.destroy({ transaction: t });
    return fb;
  });

  logger.info(`Feedback deleted - ID: ${id}`);

  res.json({
    success: true,
    message: 'Feedback deleted successfully'
  });
});