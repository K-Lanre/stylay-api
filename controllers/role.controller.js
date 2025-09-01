const { Role } = require('../models');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * Get all roles
 * @route GET /api/v1/roles
 * @access Private/Admin
 */
const getAllRoles = async (req, res, next) => {
  try {
    const roles = await Role.findAll({
      attributes: ['id', 'name', 'description'],
      order: [['id', 'ASC']]
    });

    res.status(200).json({
      status: 'success',
      results: roles.length,
      data: {
        roles
      }
    });
  } catch (error) {
    logger.error('Error fetching roles:', error);
    next(new AppError('Failed to fetch roles', 500));
  }
};

/**
 * Get a single role by ID
 * @route GET /api/v1/roles/:id
 * @access Private/Admin
 */
const getRole = async (req, res, next) => {
  try {
    const role = await Role.findByPk(req.params.id, {
      attributes: ['id', 'name', 'description']
    });

    if (!role) {
      return next(new AppError('No role found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        role
      }
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
      data: {
        role: newRole
      }
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
      data: {
        role
      }
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
