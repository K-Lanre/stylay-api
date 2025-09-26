const { User, Role, UserRole } = require('../models');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Get all users with pagination and role information
 * Returns users with their associated roles, ordered by creation date.
 * Admin access required for user management and security.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.query} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of users per page
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with paginated user list
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {number} res.body.results - Number of users in current page
 * @returns {number} res.body.total - Total number of users
 * @returns {number} res.body.totalPages - Total number of pages
 * @returns {number} res.body.currentPage - Current page number
 * @returns {Array} res.body.data - Array of user objects with roles
 * @throws {AppError} 500 - Server error during user retrieval
 * @api {get} /api/v1/users Get all users
 * @private Requires admin authentication
 * @example
 * GET /api/v1/users?page=1&limit=5
 * Authorization: Bearer <admin_jwt_token>
 */
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { count, rows: users } = await User.findAndCountAll({
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name']
        }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: users
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    next(new AppError('Failed to fetch users', 500));
  }
};

/**
 * Get a single user by ID
 * @route GET /api/v1/users/:id
 * @access Private/Admin
 */
const getUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name']
        }
      ]
    });

    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: user
    });
  } catch (error) {
    logger.error(`Error fetching user ${req.params.id}:`, error);
    next(new AppError('Failed to fetch user', 500));
  }
};

/**
 * Create a new user (admin only)
 * @route POST /api/v1/users
 * @access Private/Admin
 */
const createUser = async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, phone, gender, role_ids = [] } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    // Create user
    const user = await User.create({
      email,
      password,
      first_name,
      last_name,
      phone,
      gender,
      is_email_verified: true // Admin-created users are auto-verified
    });

    // Assign roles if provided
    if (role_ids && role_ids.length > 0) {
      const roles = await Role.findAll({
        where: { id: role_ids }
      });
      
      if (roles.length > 0) {
        await user.addRoles(roles);
      }
    }

    // Fetch the user with roles to return
    const newUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(201).json({
      status: 'success',
      data: newUser
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    next(new AppError('Failed to create user', 500));
  }
};

/**
 * Update a user
 * @route PATCH /api/v1/users/:id
 * @access Private/Admin
 */
const updateUser = async (req, res, next) => {
  try {
    const { role_ids, ...updateData } = req.body;
    
    // Don't allow password updates here (use auth/update-password instead)
    if (updateData.password) {
      return next(new AppError('Please use the update password route to change password', 400));
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    // Update user data
    await user.update(updateData);

    // Update roles if provided
    if (role_ids) {
      const roles = await Role.findAll({
        where: { id: role_ids }
      });
      
      await user.setRoles(roles);
    }

    // Fetch updated user with roles
    const updatedUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(200).json({
      status: 'success',
      data: updatedUser
    });
  } catch (error) {
    logger.error(`Error updating user ${req.params.id}:`, error);
    next(new AppError('Failed to update user', 500));
  }
};

/**
 * Delete a user
 * @route DELETE /api/v1/users/:id
 * @access Private/Admin
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    // Prevent deleting self
    if (user.id === req.user.id) {
      return next(new AppError('You cannot delete your own account', 400));
    }

    await user.destroy();

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    logger.error(`Error deleting user ${req.params.id}:`, error);
    next(new AppError('Failed to delete user', 500));
  }
};

/**
 * Assign roles to a user
 * @route POST /api/v1/users/:id/roles
 * @access Private/Admin
 */
const assignRoles = async (req, res, next) => {
  try {
    const { role_ids } = req.body;
    
    if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      return next(new AppError('Please provide at least one role ID', 400));
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    const roles = await Role.findAll({
      where: { id: role_ids }
    });

    if (roles.length !== role_ids.length) {
      return next(new AppError('One or more role IDs are invalid', 400));
    }

    // Add new roles (without removing existing ones)
    await user.addRoles(roles);

    // Fetch updated user with roles
    const updatedUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(200).json({
      status: 'success',
      data: updatedUser
    });
  } catch (error) {
    logger.error(`Error assigning roles to user ${req.params.id}:`, error);
    next(new AppError('Failed to assign roles', 500));
  }
};

/**
 * Remove roles from a user
 * @route DELETE /api/v1/users/:id/roles
 * @access Private/Admin
 */
const removeRoles = async (req, res, next) => {
  try {
    const { role_ids } = req.body;
    
    if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      return next(new AppError('Please provide at least one role ID', 400));
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    const roles = await Role.findAll({
      where: { id: role_ids }
    });

    if (roles.length === 0) {
      return next(new AppError('No valid role IDs provided', 400));
    }

    // Remove specified roles
    await user.removeRoles(roles);

    // Fetch updated user with roles
    const updatedUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(200).json({
      status: 'success',
      data: updatedUser
    });
  } catch (error) {
    logger.error(`Error removing roles from user ${req.params.id}:`, error);
    next(new AppError('Failed to remove roles', 500));
  }
};

module.exports = {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  assignRoles,
  removeRoles
};
