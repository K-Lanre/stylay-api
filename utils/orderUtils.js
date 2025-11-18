/**
 * Utility functions for order management
 */

/**
 * Generates a unique order number
 * Format: STY-{timestamp}-{padded_id}
 * Example: STY-1731400000000-00001234
 *
 * @param {number} orderId - The order ID to include in the order number
 * @returns {string} The generated order number
 */
function generateOrderNumber(orderId) {
  const timestamp = Date.now();
  const paddedId = String(orderId).padStart(8, '0');
  return `STY-${timestamp}-${paddedId}`;
}

/**
 * Validates an order number format
 * @param {string} orderNumber - The order number to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidOrderNumber(orderNumber) {
  const pattern = /^STY-\d+-\d{8}$/;
  return pattern.test(orderNumber);
}

/**
 * Extracts order ID from order number
 * @param {string} orderNumber - The order number (format: STY-{timestamp}-{padded_id})
 * @returns {number|null} The extracted order ID or null if invalid
 */
function extractOrderIdFromNumber(orderNumber) {
  if (!isValidOrderNumber(orderNumber)) {
    return null;
  }

  const parts = orderNumber.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const paddedId = parts[2];
  return parseInt(paddedId, 10);
}

module.exports = {
  generateOrderNumber,
  isValidOrderNumber,
  extractOrderIdFromNumber,
};
