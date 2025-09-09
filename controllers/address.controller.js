const { Address } = require("../models");
const { Op } = require("sequelize");

// Get all addresses for the authenticated user
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

// Get a single address by ID
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

// Create a new address
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

// Update an existing address
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

// Delete an address
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

// Set default address
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
