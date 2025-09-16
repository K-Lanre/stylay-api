const nodemailer = require("nodemailer");
const path = require("path");
const ejs = require("ejs");
const { promisify } = require("util");
const fs = require("fs");
const logger = require("../utils/logger");
const { User, PaymentTransaction } = require("../models");

// Promisify fs.readFile
const readFile = promisify(fs.readFile);

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.ethereal.email",
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || "eunice.kulas72@ethereal.email",
    pass: process.env.EMAIL_PASS || "qz1VDFMbCebZswXdMw",
  },
  tls: {
    rejectUnauthorized: false, // Only for development with self-signed certificates
  },
});

// Email templates directory
const templatesDir = path.join(__dirname, "../views/emails");

// Email templates with their subject lines
const emailTemplates = {
  WELCOME: {
    template: "welcome.ejs",
    subject: "Welcome to Stylay - Verify Your Email",
  },
  PASSWORD_RESET: {
    template: "password-reset.ejs",
    subject: "Password Reset Request",
  },
  ORDER_CONFIRMATION: {
    template: "order-confirmation.ejs",
    subject: "Order Confirmation - #%s",
  },
  PAYMENT_RECEIVED: {
    template: "payment-received.ejs",
    subject: "Payment Received - Order #%s",
  },
  PAYMENT_FAILED: {
    template: "payment-failed.ejs",
    subject: "Payment Failed - Order #%s",
  },
  ORDER_SHIPPED: {
    template: "order-shipped.ejs",
    subject: "Your Order #%s Has Been Shipped",
  },
  ORDER_DELIVERED: {
    template: "order-delivered.ejs",
    subject: "Your Order #%s Has Been Delivered",
  },
  ORDER_CANCELLED: {
    template: "order-cancelled.ejs",
    subject: "Order #%s Has Been Cancelled",
  },
  VENDOR_ORDER: {
    template: "vendor-order.ejs",
    subject: "New Order #%s - Action Required",
  },
  VENDOR_APPROVED: {
    template: "vendor-approved.ejs",
    subject: "Your Vendor Account Has Been Approved!",
  },
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
    const template = await readFile(templatePath, "utf-8");
    return ejs.render(template, {
      ...data,
      appName: "Stylay",
      year: new Date().getFullYear(),
      frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    });
  } catch (error) {
    logger.error("Error rendering email template:", error);
    throw new Error("Failed to render email template");
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
      from: `"${process.env.EMAIL_FROM_NAME || "Stylay"}" <${
        process.env.EMAIL_FROM
      }>`,
      to,
      subject: templateConfig.subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error("Error sending email:", error);
    throw new Error("Failed to send email");
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
 * @param {Date} tokenExpires - Expiration date of the verification code
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendWelcomeEmail = async (to, name, code, tokenExpires) => {
  return sendEmail(to, "WELCOME", {
    name,
    code,
    tokenExpires,
    appName: process.env.APP_NAME || "Stylay",
    frontendUrl: process.env.FRONTEND_URL || "https://stylay.com",
    year: new Date().getFullYear(),
  });
};

/**
 * Send password reset email with verification code
 * @param {string} to - Recipient email address
 * @param {string} name - User's name
 * @param {string} code - 6-digit verification code
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendPasswordResetEmail = async (to, name, code) => {
  const resetUrl = `${
    process.env.FRONTEND_URL || "https://stylay.com"
  }/reset-password`;

  return sendEmail(to, "PASSWORD_RESET", {
    user: { name },
    resetCode: code,
    resetUrl: `${resetUrl}?code=${code}`,
    appName: process.env.APP_NAME || "Stylay",
    frontendUrl: process.env.FRONTEND_URL || "https://stylay.com",
    year: new Date().getFullYear(),
  });
};

/**
 * Send order confirmation email
 * @param {string} to - Recipient email address
 * @param {Object} order - Order details
 * @returns {Promise} - Promise that resolves when email is sent
 */
/**
 * Get user email by ID
 * @param {string} userId - User ID
 * @returns {Promise<string>} - User's email address
 */
const getUserEmail = async (userId) => {
  try {
    const user = await User.findByPk(userId, {
      attributes: ['email'],
      raw: true
    });
    
    if (!user || !user.email) {
      throw new Error(`User with ID ${userId} not found or has no email`);
    }
    
    return user.email;
  } catch (error) {
    logger.error('Error fetching user email:', error);
    throw error;
  }
};

/**
 * Send order confirmation email
 * @param {Object} order - Order details
 * @param {string} userId - User ID for the order
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendOrderConfirmation = async (order, userId) => {
  try {
    const userEmail = await getUserEmail(userId);
    return await sendEmail(userEmail, 'ORDER_CONFIRMATION', { 
      order,
      user: { id: userId },
      orderDate: new Date().toLocaleDateString(),
      trackingUrl: `${process.env.FRONTEND_URL}/orders/${order.id}/track`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@stylay.com'
    });
  } catch (error) {
    logger.error('Error sending order confirmation email:', error);
    throw error;
  }
};

/**
 * Log a payment transaction
 * @param {Object} transactionData - Transaction data
 * @returns {Promise<Object>} - The created transaction
 */
const logPaymentTransaction = async (transactionData) => {
  try {
    const transaction = await PaymentTransaction.create({
      user_id: transactionData.userId,
      order_id: transactionData.orderId,
      type: transactionData.type || 'payment', // payment, payout, refund, commission, adjustment
      amount: transactionData.amount,
      status: transactionData.status || 'completed',
      transaction_id: transactionData.transactionId,
      description: transactionData.description
    });
    
    return transaction;
  } catch (error) {
    logger.error('Error logging payment transaction:', error);
    throw error;
  }
};

/**
 * Send payment received confirmation email and log the transaction
 * @param {Object} order - Order details
 * @param {string} userId - User ID for the order
 * @param {Object} paymentDetails - Payment details
 * @returns {Promise} - Promise that resolves when email is sent and transaction is logged
 */
const sendPaymentReceived = async (order, userId, paymentDetails) => {
  let emailResponse;
  
  try {
    // Get user email
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Log the payment transaction
    await logPaymentTransaction({
      userId,
      orderId: order.id,
      type: 'payment',
      amount: paymentDetails.amount,
      status: 'completed',
      transactionId: paymentDetails.transactionId,
      description: `Payment received for order #${order.id}`
    });
    
    // Send the email
    emailResponse = await sendEmail(userEmail, 'PAYMENT_RECEIVED', { 
      order,
      user: { id: userId },
      payment: paymentDetails,
      paymentDate: new Date().toLocaleDateString(),
      orderUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`
    });
    
    return emailResponse;
  } catch (error) {
    // Log the failed transaction if we have the details
    if (order && userId && paymentDetails) {
      try {
        await logPaymentTransaction({
          userId,
          orderId: order.id,
          type: 'payment',
          amount: paymentDetails.amount,
          status: 'failed',
          transactionId: paymentDetails.transactionId,
          description: `Failed to process payment email for order #${order.id}: ${error.message}`
        });
      } catch (logError) {
        logger.error('Error logging failed payment transaction:', logError);
      }
    }
    
    logger.error('Error in sendPaymentReceived:', error);
    throw error;
  }
};

/**
 * Send payment failed notification email and log the failed transaction
 * @param {Object} order - Order details
 * @param {string} userId - User ID for the order
 * @param {Object} paymentDetails - Payment details including error information
 * @returns {Promise} - Promise that resolves when email is sent and transaction is logged
 */
const sendPaymentFailed = async (order, userId, paymentDetails = {}) => {
  try {
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Log the failed payment transaction
    if (paymentDetails.amount) {
      await logPaymentTransaction({
        userId,
        orderId: order?.id,
        type: 'payment',
        amount: paymentDetails.amount,
        status: 'failed',
        transactionId: paymentDetails.transactionId,
        description: `Payment failed: ${paymentDetails.error || 'Unknown error'}`
      });
    }
    
    return await sendEmail(userEmail, 'PAYMENT_FAILED', { 
      order,
      user: { id: userId },
      payment: paymentDetails,
      errorMessage: paymentDetails.error || 'Payment processing failed',
      retryUrl: `${process.env.FRONTEND_URL}/orders/${order?.id}/retry-payment`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@stylay.com',
      supportPhone: process.env.SUPPORT_PHONE || '+1 (555) 123-4567'
    });
  } catch (error) {
    logger.error('Error in sendPaymentFailed:', error);
    throw error;
  }
};

/**
 * Send order shipped notification email
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID for the order
 * @param {Object} trackingInfo - Tracking information
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendOrderShipped = async (orderId, userId, trackingInfo) => {
  try {
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return await sendEmail(userEmail, 'ORDER_SHIPPED', { 
      order: { id: orderId, ...trackingInfo },
      user: { id: userId },
      trackingUrl: trackingInfo?.trackingUrl || `${process.env.FRONTEND_URL}/orders/${orderId}/track`
    });
  } catch (error) {
    logger.error('Error sending order shipped email:', error);
    throw error;
  }
};

/**
 * Send order delivered notification email
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID for the order
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendOrderDelivered = async (orderId, userId) => {
  try {
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return await sendEmail(userEmail, 'ORDER_DELIVERED', { 
      order: { id: orderId },
      user: { id: userId },
      reviewUrl: `${process.env.FRONTEND_URL}/orders/${orderId}/review`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@stylay.com'
    });
  } catch (error) {
    logger.error('Error sending order delivered email:', error);
    throw error;
  }
};

/**
 * Send order cancellation notification email
 * @param {Object} order - Order details
 * @param {string} userId - User ID for the order
 * @param {string} reason - Reason for cancellation
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendOrderCancelled = async (order, userId, reason) => {
  try {
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return await sendEmail(userEmail, 'ORDER_CANCELLED', { 
      order,
      user: { id: userId },
      reason: reason || 'Not specified',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@stylay.com'
    });
  } catch (error) {
    logger.error('Error sending order cancellation email:', error);
    throw error;
  }
};

/**
 * Notify vendors about new order
 * @param {string|number} orderId - Order ID
 * @returns {Promise<Array>} - Array of sent email promises
 */
const notifyVendors = async (orderId) => {
  const { Order, Vendor } = require('../models');
  
  try {
    // Find the order with its items and include vendor information
    const order = await Order.findByPk(orderId, {
      include: [
        {
          association: 'items',
          include: [
            {
              model: Vendor,
              as: 'vendor',
              include: [
                {
                  model: User,
                  attributes: ['email', 'first_name', 'last_name']
                },
                {
                  model: Store,
                  attributes: ['business_name']
                }
              ],
              attributes: ['id']
            }
          ]
        }
      ]
    });

    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }

    // Extract unique vendors from order items
    const vendorMap = new Map();
    
    order.items.forEach(item => {
      if (item.vendor) {
        const vendor = item.vendor;
        if (!vendorMap.has(vendor.id)) {
          const vendorData = {
            id: vendor.id,
            email: vendor.User?.email,
            name: vendor.User?.first_name ? 
              `${vendor.User.first_name} ${vendor.User.last_name || ''}`.trim() : 
              vendor.Store?.business_name || 'Vendor',
            storeName: vendor.Store?.business_name
          };
          vendorMap.set(vendor.id, vendorData);
        }
      }
    });

    const vendors = Array.from(vendorMap.values());
    
    if (vendors.length === 0) {
      logger.warn(`No vendors found for order ${orderId}`);
      return [];
    }

    // Send notifications to all vendors
    const sendPromises = vendors.map(vendor => {
      if (!vendor.email) {
        logger.warn(`Vendor ${vendor.id} has no email address`);
        return Promise.resolve();
      }
      
      return sendEmail(vendor.email, 'VENDOR_ORDER', {
        orderId,
        vendor,
        orderUrl: `${process.env.VENDOR_PORTAL_URL}/orders/${orderId}`
      });
    });
    
    return Promise.all(sendPromises);
  } catch (error) {
    logger.error('Error notifying vendors:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmation,
  sendPaymentReceived,
  sendPaymentFailed,
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderCancelled,
  notifyVendors,
  transporter,
};
