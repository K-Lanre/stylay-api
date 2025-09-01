const nodemailer = require('nodemailer');
const path = require('path');
const ejs = require('ejs');
const { promisify } = require('util');
const fs = require('fs');
const logger = require('../utils/logger');

// Promisify fs.readFile
const readFile = promisify(fs.readFile);

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Only for development with self-signed certificates
  }
});

// Email templates directory
const templatesDir = path.join(__dirname, '../views/emails');

// Email templates with their subject lines
const emailTemplates = {
  WELCOME: {
    template: 'welcome.ejs',
    subject: 'Welcome to Stylay - Verify Your Email',
  },
  PASSWORD_RESET: {
    template: 'password-reset.ejs',
    subject: 'Password Reset Request',
  },
  ORDER_CONFIRMATION: {
    template: 'order-confirmation.ejs',
    subject: 'Order Confirmation - #',
  },
  // Add more templates as needed
};

/**
 * Render an email template
 * @param {string} templateName - Template name (without extension)
 * @param {Object} context - Data to be passed to the template
 * @returns {Promise} - Promise that resolves with the rendered template
 */
const renderTemplate = async (templateName, data = {}) => {
  try {
    const templatePath = path.join(templatesDir, templateName);
    const template = await readFile(templatePath, 'utf-8');
    return ejs.render(template, {
      ...data,
      appName: 'Stylay',
      year: new Date().getFullYear(),
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    });
  } catch (error) {
    logger.error('Error rendering email template:', error);
    throw new Error('Failed to render email template');
  }
};

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} templateType - Email template type
 * @param {Object} context - Data to be passed to the template
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendEmail = async (to, templateType, context = {}) => {
  try {
    const templateConfig = emailTemplates[templateType];
    if (!templateConfig) {
      throw new Error(`Email template ${templateType} not found`);
    }

    const html = await renderTemplate(templateConfig.template, context);

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Stylay'}" <${process.env.EMAIL_FROM}>`,
      to,
      subject: templateConfig.subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send a welcome email to new users
 * @param {string} to - Recipient email address
 * @param {string} name - User's name
 * @param {string} token - Email verification token
 * @returns {Promise} - Promise that resolves when email is sent
 */
/**
 * Send welcome email with verification code
 * @param {string} to - Recipient email address
 * @param {string} name - User's name
 * @param {string} code - 6-digit verification code
 * @returns {Promise} - Promise that resolves when email is sent
 */
/**
 * Send welcome email with verification code
 * @param {string} to - Recipient email address
 * @param {string} name - User's name
 * @param {string} code - 6-digit verification code
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendWelcomeEmail = async (to, name, code) => {
  return sendEmail(
    to,
    'WELCOME',
    { 
      name,
      code,
      appName: process.env.APP_NAME || 'Stylay',
      frontendUrl: process.env.FRONTEND_URL || 'https://stylay.com',
      year: new Date().getFullYear()
    }
  );
};

/**
 * Send password reset email with verification code
 * @param {string} to - Recipient email address
 * @param {string} name - User's name
 * @param {string} code - 6-digit verification code
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendPasswordResetEmail = async (to, name, code) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'https://stylay.com'}/reset-password`;
  
  return sendEmail(
    to,
    'PASSWORD_RESET',
    { 
      user: { name },
      resetCode: code,
      resetUrl: `${resetUrl}?code=${code}`,
      appName: process.env.APP_NAME || 'Stylay',
      frontendUrl: process.env.FRONTEND_URL || 'https://stylay.com',
      year: new Date().getFullYear()
    }
  );
};

/**
 * Send order confirmation email
 * @param {string} to - Recipient email address
 * @param {Object} order - Order details
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendOrderConfirmationEmail = async (to, order) => {
  return sendEmail(
    to,
    'ORDER_CONFIRMATION',
    { 
      order,
      year: new Date().getFullYear()
    }
  );
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  transporter
};
