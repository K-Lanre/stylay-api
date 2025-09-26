const { Address } = require("../models");
const { Op } = require("sequelize");

/**
 * Get all addresses for the authenticated user
 * Returns addresses ordered by default status first, then by creation date.
 * Excludes sensitive information and provides clean address data.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with user's addresses
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Array} res.body.data - Array of address objects
 * @throws {Error} 500 - Server error during database query
 * @api {get} /api/v1/addresses Get user addresses
 * @private Requires authentication
 * @example
 * GET /api/v1/addresses
 * Authorization: Bearer <jwt_token>
 */
const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    const addresses = await Address.findAll({
      where: { user_id: userId },
      order: [
        ["is_default", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    res.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error("Error getting addresses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get addresses",
      error: error.message,
    });
  }
};

/**
 * Get a single address by ID for the authenticated user
 * Verifies that the address belongs to the authenticated user before returning it.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Address ID to retrieve
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with address data
 * @returns {Object} res.body.success - Response status (true)
 * @returns {Object} res.body.data - Address object
 * @throws {Object} 404 - Address not found or doesn't belong to user
 * @throws {Error} 500 - Server error during database query
 * @api {get} /api/v1/addresses/:id Get address by ID
 * @private Requires authentication
 * @example
 * GET /api/v1/addresses/123
 * Authorization: Bearer <jwt_token>
 */
const getAddressById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const address = await Address.findOne({
      where: {
        id,
        user_id: userId,
      },
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    res.json({
      success: true,
      data: address,
    });
  } catch (error) {
    console.error("Error getting address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get address",
      error: error.message,
    });
  }
};

/**
 * Create a new address for the authenticated user
 * Validates required fields and handles default address logic using database transactions.
 * If marked as default, automatically removes default status from other addresses.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.body} req.body - Request body
 * @param {string} req.body.label - Optional address label (e.g., "Home", "Work")
 * @param {string} req.body.address_line - Street address (required)
 * @param {string} req.body.city - City name (required)
 * @param {string} req.body.state - State/province name (required)
 * @param {string} req.body.country - Country name (required)
 * @param {string} req.body.postal_code - Postal/ZIP code (optional)
 * @param {boolean} [req.body.is_default=false] - Whether this should be the default address
 * @param {string} req.body.phone - Contact phone number for this address (optional)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with created address
 * @returns {Object} res.body.success - Response status (true)
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Created address object
 * @throws {Object} 400 - Missing required fields (address_line, city, state, country)
 * @throws {Error} 500 - Server error during creation
 * @api {post} /api/v1/addresses Create address
 * @private Requires authentication
 * @example
 * POST /api/v1/addresses
 * Authorization: Bearer <jwt_token>
 * {
 *   "label": "Home",
 *   "address_line": "123 Main Street",
 *   "city": "Lagos",
 *   "state": "Lagos",
 *   "country": "Nigeria",
 *   "postal_code": "100001",
 *   "is_default": true,
 *   "phone": "+2348012345678"
 * }
 */
const createAddress = async (req, res) => {
  const transaction = await Address.sequelize.transaction();

  try {
    const userId = req.user.id;
    const {
      label,
      address_line,
      city,
      state,
      country,
      postal_code,
      is_default = false,
      phone,
    } = req.body;

    // Validate required fields
    if (!address_line || !city || !state || !country) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Address line, city, state, and country are required",
      });
    }

    // If setting as default, update other addresses
    if (is_default) {
      await Address.update(
        { is_default: false },
        {
          where: { user_id: userId },
          transaction,
        }
      );
    }

    const newAddress = await Address.create(
      {
        user_id: userId,
        label: label || null,
        address_line,
        city,
        state,
        country,
        postal_code: postal_code || null,
        is_default,
        phone: phone || null,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: newAddress,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create address",
      error: error.message,
    });
  }
};

/**
 * Update an existing address for the authenticated user
 * Allows partial updates and handles default address logic using database transactions.
 * If setting as default, automatically removes default status from other addresses.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Address ID to update
 * @param {import('express').Request.body} req.body - Request body with updateable fields
 * @param {string} [req.body.label] - Address label
 * @param {string} [req.body.address_line] - Street address
 * @param {string} [req.body.city] - City name
 * @param {string} [req.body.state] - State/province name
 * @param {string} [req.body.country] - Country name
 * @param {string} [req.body.postal_code] - Postal/ZIP code
 * @param {boolean} [req.body.is_default] - Whether this should be the default address
 * @param {string} [req.body.phone] - Contact phone number
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with updated address
 * @returns {Object} res.body.success - Response status (true)
 * @returns {string} res.body.message - Success message
 * @returns {Object} res.body.data - Updated address object
 * @throws {Object} 404 - Address not found or doesn't belong to user
 * @throws {Error} 500 - Server error during update
 * @api {put} /api/v1/addresses/:id Update address
 * @private Requires authentication
 * @example
 * PUT /api/v1/addresses/123
 * Authorization: Bearer <jwt_token>
 * {
 *   "label": "Work Address",
 *   "phone": "+2348012345678"
 * }
 */
const updateAddress = async (req, res) => {
  const transaction = await Address.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      label,
      address_line,
      city,
      state,
      country,
      postal_code,
      is_default,
      phone,
    } = req.body;

    // Find the address
    const address = await Address.findOne({
      where: {
        id,
        user_id: userId,
      },
      transaction,
    });

    if (!address) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If setting as default, update other addresses
    if (is_default === true) {
      await Address.update(
        { is_default: false },
        {
          where: {
            user_id: userId,
            id: { [Op.ne]: id }, // Exclude current address
          },
          transaction,
        }
      );
    }

    // Update address fields
    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (address_line) updateData.address_line = address_line;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (country) updateData.country = country;
    if (postal_code !== undefined) updateData.postal_code = postal_code;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (phone !== undefined) updateData.phone = phone;

    await Address.update(updateData, {
      where: { id },
      transaction,
    });

    await transaction.commit();

    const updatedAddress = await Address.findByPk(id);

    res.json({
      success: true,
      message: "Address updated successfully",
      data: updatedAddress,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: error.message,
    });
  }
};

/**
 * Delete an address for the authenticated user
 * Uses database transactions and handles default address reassignment.
 * If deleting the default address, automatically sets another address as default.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Address ID to delete
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming deletion
 * @returns {Object} res.body.success - Response status (true)
 * @returns {string} res.body.message - Success message
 * @throws {Object} 404 - Address not found or doesn't belong to user
 * @throws {Error} 500 - Server error during deletion
 * @api {delete} /api/v1/addresses/:id Delete address
 * @private Requires authentication
 * @example
 * DELETE /api/v1/addresses/123
 * Authorization: Bearer <jwt_token>
 */
const deleteAddress = async (req, res) => {
  const transaction = await Address.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find the address
    const address = await Address.findOne({
      where: {
        id,
        user_id: userId,
      },
      transaction,
    });

    if (!address) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If deleting default address, set another address as default
    if (address.is_default) {
      const anotherAddress = await Address.findOne({
        where: {
          user_id: userId,
          id: { [Op.ne]: id },
        },
        order: [["created_at", "DESC"]],
        transaction,
      });

      if (anotherAddress) {
        await anotherAddress.update({ is_default: true }, { transaction });
      }
    }

    await address.destroy({ transaction });
    await transaction.commit();

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: error.message,
    });
  }
};

/**
 * Set a specific address as the default address for the authenticated user
 * Uses database transactions to ensure data consistency.
 * Automatically removes default status from all other addresses.
 *
 * @param {import('express').Request} req - Express request object (authenticated user required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Address ID to set as default
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response confirming default address update
 * @returns {Object} res.body.success - Response status (true)
 * @returns {string} res.body.message - Success message
 * @throws {Object} 404 - Address not found or doesn't belong to user
 * @throws {Error} 500 - Server error during update
 * @api {patch} /api/v1/addresses/:id/default Set default address
 * @private Requires authentication
 * @example
 * PATCH /api/v1/addresses/123/default
 * Authorization: Bearer <jwt_token>
 */
const setDefaultAddress = async (req, res) => {
  const transaction = await Address.sequelize.transaction();

  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find the address
    const address = await Address.findOne({
      where: {
        id,
        user_id: userId,
      },
      transaction,
    });

    if (!address) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Update all addresses to not default
    await Address.update(
      { is_default: false },
      {
        where: {
          user_id: userId,
          id: { [Op.ne]: id },
        },
        transaction,
      }
    );

    // Set the selected address as default
    await address.update({ is_default: true }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Default address updated successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error setting default address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set default address",
      error: error.message,
    });
  }
};

module.exports = {
  getUserAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
