const { Role, Permission } = require('../models');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * Get all user roles in the system
 * Returns all roles ordered by ID in ascending order.
 * Admin access required for role management.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with all roles
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {number} res.body.results - Number of roles returned
 * @returns {Array} res.body.data.roles - Array of role objects
 * @throws {AppError} 500 - Server error during role retrieval
 * @api {get} /api/v1/roles Get all roles
 * @private Requires admin authentication
 * @example
 * GET /api/v1/roles
 * Authorization: Bearer <admin_jwt_token>
 */
const getAllRoles = async (req, res, next) => {
  try {
    const roles = await Role.findAll({
      attributes: ['id', 'name', 'description'],
      include: [
        {
          model: Permission,
          as: 'permissions',
          attributes: ['id', 'name', 'description'],
          through: { attributes: [] } // exclude junction table attributes
        }
      ],
      order: [['id', 'ASC']]
    });

    res.status(200).json({
      status: 'success',
      results: roles.length,
      data: roles
    });
  } catch (error) {
    logger.error('Error fetching roles:', error);
    next(new AppError('Failed to fetch roles', 500));
  }
};

/**
 * Get a single role by ID
 * Retrieves detailed information about a specific role.
 * Admin access required for role management.
 *
 * @param {import('express').Request} req - Express request object (admin authentication required)
 * @param {import('express').Request.params} req.params - Route parameters
 * @param {string} req.params.id - Role ID to retrieve
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {Object} Success response with role details
 * @returns {Object} res.body.status - Response status ("success")
 * @returns {Object} res.body.data.role - Role object with id, name, description
 * @throws {AppError} 404 - Role not found
 * @throws {AppError} 500 - Server error during role retrieval
 * @api {get} /api/v1/roles/:id Get role by ID
 * @private Requires admin authentication
 * @example
 * GET /api/v1/roles/1
 * Authorization: Bearer <admin_jwt_token>
 */
const getRole = async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id, {
      attributes: ['id', 'name', 'description'],
      include: [
        {
          model: Permission,
          as: 'permissions',
          attributes: ['id', 'name', 'description'],
          through: { attributes: [] } // exclude junction table attributes
        }
      ]
    });

    if (!role) {
      return next(new AppError('No role found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: role
    });
  } catch (error) {
    logger.error(`Error fetching role ${req.params.id}:`, error);
    next(new AppError('Failed to fetch role', 500));
  }
};

/**
 * Create a new role
 * @route POST /api/v1/roles
 * @access Private/Admin
 */
const createRole = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const newRole = await Role.create({
      name: name.toLowerCase(),
      description
    });

    res.status(201).json({
      status: 'success',
      data: newRole
    });
  } catch (error) {
    logger.error('Error creating role:', error);
    next(new AppError('Failed to create role', 500));
  }
};

/**
 * Update a role
 * @route PATCH /api/v1/roles/:id
 * @access Private/Admin
 */
const updateRole = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const role = await Role.findByPk(req.params.id);

    if (!role) {
      return next(new AppError('No role found with that ID', 404));
    }

    await role.update({
      name: name ? name.toLowerCase() : role.name,
      description: description || role.description
    });

    res.status(200).json({
      status: 'success',
      data: role
    });
  } catch (error) {
    logger.error(`Error updating role ${req.params.id}:`, error);
    next(new AppError('Failed to update role', 500));
  }
};

/**
 * Delete a role
 * @route DELETE /api/v1/roles/:id
 * @access Private/Admin
 */
const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id);

    if (!role) {
      return next(new AppError('No role found with that ID', 404));
    }

    await role.destroy();

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    logger.error(`Error deleting role ${req.params.id}:`, error);
    next(new AppError('Failed to delete role', 500));
  }
};

module.exports = {
  getAllRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole
};
