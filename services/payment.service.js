const axios = require('axios');
const crypto = require('crypto');
const AppError = require('../utils/appError');


class PaymentService {
  constructor() {
    this.paystack = axios.create({
      baseURL: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });
    
    // Initialize sub-services
    this.transactions = new TransactionService(this.paystack);
    this.customers = new CustomerService(this.paystack);
    this.transfers = new TransferService(this.paystack);
    this.plans = new PlanService(this.paystack);
    this.subscriptions = new SubscriptionService(this.paystack);
    this.refunds = new RefundService(this.paystack);
    this.settlements = new SettlementService(this.paystack);
    this.subaccounts = new SubaccountService(this.paystack);
    this.paymentPages = new PaymentPageService(this.paystack);
    this.dedicatedAccounts = new DedicatedAccountService(this.paystack);
  }

  /**
   * Initialize a new payment transaction
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment initialization response
   */
  async initializePayment(paymentData) {
    try {
      const response = await this.paystack.post('/transaction/initialize', {
        email: paymentData.email,
        amount: Math.round(paymentData.amount * 100), // Convert to kobo
        reference: paymentData.reference,
        currency: 'NGN',
        callback_url: paymentData.callbackUrl,
        metadata: {
          orderId: paymentData.orderId,
          userId: paymentData.userId,
          items: paymentData.items,
        },
      });

      return response.data;
    } catch (error) {
      console.error('PayStack initialization error:', error.response?.data || error.message);
      throw new AppError('Payment initialization failed', 400);
    }
  }

  /**
   * Verify a payment transaction
   * @param {string} reference - Transaction reference
   * @returns {Promise<Object>} Transaction verification response
   */
  async verifyPayment(reference) {
    try {
      const response = await this.paystack.get(`/transaction/verify/${reference}`);
      return response.data;
    } catch (error) {
      console.error('PayStack verification error:', error.response?.data || error.message);
      throw new AppError('Payment verification failed', 400);
    }
  }

  /**
   * Handle PayStack webhook
   * @param {Object} event - Webhook event data
   * @returns {Promise<Object>} Webhook processing result
   */
  async handleWebhook(event) {
    try {
      // Verify the event is from PayStack
      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
        .update(JSON.stringify(event))
        .digest('hex');

      if (hash !== req.headers['x-paystack-signature']) {
        throw new AppError('Invalid webhook signature', 401);
      }

      const { event: eventType, data } = event;

      switch (eventType) {
        case 'charge.success':
          return await this.handleSuccessfulCharge(data);
        case 'charge.failed':
          return await this.handleFailedCharge(data);
        case 'transfer.success':
          return await this.handleSuccessfulTransfer(data);
        case 'transfer.failed':
          return await this.handleFailedTransfer(data);
        default:
          return { status: 'success', message: 'Event not handled' };
      }
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  // ======================
  // Transaction Methods
  // ======================

  /**
   * List transactions
   * @param {Object} options - Query parameters
   * @returns {Promise<Object>} List of transactions
   */
  async listTransactions(options = {}) {
    try {
      const response = await this.paystack.get('/transaction', { params: options });
      return response.data;
    } catch (error) {
      this._handleError('Failed to list transactions', error);
    }
  }

  /**
   * Fetch a single transaction
   * @param {string|number} id - Transaction ID or reference
   * @returns {Promise<Object>} Transaction details
   */
  async fetchTransaction(id) {
    try {
      const response = await this.paystack.get(`/transaction/${id}`);
      return response.data;
    } catch (error) {
      this._handleError('Failed to fetch transaction', error);
    }
  }

  /**
   * Charge authorization
   * @param {Object} chargeData - Charge details
   * @returns {Promise<Object>} Charge response
   */
  async chargeAuthorization(chargeData) {
    try {
      const response = await this.paystack.post('/transaction/charge_authorization', {
        ...chargeData,
        amount: Math.round(chargeData.amount * 100), // Convert to kobo
      });
      return response.data;
    } catch (error) {
      this._handleError('Charge authorization failed', error);
    }
  }

  /**
   * Check authorization
   * @param {Object} authData - Authorization details
   * @returns {Promise<Object>} Authorization check response
   */
  async checkAuthorization(authData) {
    try {
      const response = await this.paystack.post('/transaction/check_authorization', {
        ...authData,
        amount: Math.round(authData.amount * 100), // Convert to kobo
      });
      return response.data;
    } catch (error) {
      this._handleError('Authorization check failed', error);
    }
  }

  // ======================
  // Customer Methods
  // ======================

  /**
   * Create a customer
   * @param {Object} customerData - Customer details
   * @returns {Promise<Object>} Created customer
   */
  async createCustomer(customerData) {
    try {
      const response = await this.paystack.post('/customer', customerData);
      return response.data;
    } catch (error) {
      this._handleError('Failed to create customer', error);
    }
  }

  /**
   * List customers
   * @param {Object} options - Query parameters
   * @returns {Promise<Object>} List of customers
   */
  async listCustomers(options = {}) {
    try {
      const response = await this.paystack.get('/customer', { params: options });
      return response.data;
    } catch (error) {
      this._handleError('Failed to list customers', error);
    }
  }

  // ======================
  // Transfer Methods
  // ======================

  /**
   * Initiate transfer
   * @param {Object} transferData - Transfer details
   * @returns {Promise<Object>} Transfer response
   */
  async initiateTransfer(transferData) {
    try {
      const response = await this.paystack.post('/transfer', {
        ...transferData,
        amount: Math.round(transferData.amount * 100), // Convert to kobo
      });
      return response.data;
    } catch (error) {
      this._handleError('Transfer initiation failed', error);
    }
  }

  // ======================
  // Plan & Subscription Methods
  // ======================

  /**
   * Create a plan
   * @param {Object} planData - Plan details
   * @returns {Promise<Object>} Created plan
   */
  async createPlan(planData) {
    try {
      const response = await this.paystack.post('/plan', {
        ...planData,
        amount: Math.round(planData.amount * 100), // Convert to kobo
      });
      return response.data;
    } catch (error) {
      this._handleError('Failed to create plan', error);
    }
  }

  // ======================
  // Refund Methods
  // ======================

  /**
   * Create a refund
   * @param {Object} refundData - Refund details
   * @returns {Promise<Object>} Refund response
   */
  async createRefund(refundData) {
    try {
      const response = await this.paystack.post('/refund', refundData);
      return response.data;
    } catch (error) {
      this._handleError('Refund creation failed', error);
    }
  }

  // ======================
  // Utility Methods
  // ======================

  /**
   * Handle API errors
   * @private
   */
  _handleError(message, error) {
    console.error(`${message}:`, error.response?.data || error.message);
    throw new AppError(message, error.response?.status || 400);
  }

  // Private handler methods
  async handleSuccessfulCharge(data) {
    // Update order status to paid
    // Send confirmation email
    // Process vendor payouts if needed
    return { status: 'success', message: 'Charge successful' };
  }

  async handleFailedCharge(data) {
    // Update order status to payment_failed
    // Send failure notification
    return { status: 'success', message: 'Charge failed' };
  }

  async handleSuccessfulTransfer(data) {
    // Update vendor balance
    // Log successful transfer
    return { status: 'success', message: 'Transfer successful' };
  }

  async handleFailedTransfer(data) {
    // Log failed transfer
    // Notify admin
    return { status: 'success', message: 'Transfer failed' };
  }
}

// Sub-service classes
class TransactionService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async list(options = {}) {
    const response = await this.paystack.get('/transaction', { params: options });
    return response.data;
  }

  async fetch(id) {
    const response = await this.paystack.get(`/transaction/${id}`);
    return response.data;
  }

  async chargeAuthorization(chargeData) {
    const response = await this.paystack.post('/transaction/charge_authorization', {
      ...chargeData,
      amount: Math.round(chargeData.amount * 100),
    });
    return response.data;
  }

  async exportTransactions(params = {}) {
    const response = await this.paystack.get('/transaction/export', { params });
    return response.data;
  }
}

class CustomerService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async create(customerData) {
    const response = await this.paystack.post('/customer', customerData);
    return response.data;
  }

  async list(params = {}) {
    const response = await this.paystack.get('/customer', { params });
    return response.data;
  }

  async fetch(customerId) {
    const response = await this.paystack.get(`/customer/${customerId}`);
    return response.data;
  }
}

class TransferService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async initiate(transferData) {
    const response = await this.paystack.post('/transfer', {
      ...transferData,
      amount: Math.round(transferData.amount * 100),
    });
    return response.data;
  }

  async list(params = {}) {
    const response = await this.paystack.get('/transfer', { params });
    return response.data;
  }
}

class PlanService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async create(planData) {
    const response = await this.paystack.post('/plan', {
      ...planData,
      amount: Math.round(planData.amount * 100),
    });
    return response.data;
  }
}

class SubscriptionService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async create(subscriptionData) {
    const response = await this.paystack.post('/subscription', subscriptionData);
    return response.data;
  }
}

class RefundService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async create(refundData) {
    const response = await this.paystack.post('/refund', refundData);
    return response.data;
  }
}

class SettlementService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async list(params = {}) {
    const response = await this.paystack.get('/settlement', { params });
    return response.data;
  }
}

class SubaccountService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async create(subaccountData) {
    const response = await this.paystack.post('/subaccount', subaccountData);
    return response.data;
  }
}

class PaymentPageService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async create(pageData) {
    const response = await this.paystack.post('/page', pageData);
    return response.data;
  }
}

class DedicatedAccountService {
  constructor(paystack) {
    this.paystack = paystack;
  }

  async create(dedicatedAccountData) {
    const response = await this.paystack.post('/dedicated_account', dedicatedAccountData);
    return response.data;
  }
}

module.exports = new PaymentService();
