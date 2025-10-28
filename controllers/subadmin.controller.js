const {
  User,
  Role,
  UserRole,
  Permission,
  RolePermission,
  sequelize,
} = require("../models");
const { Op, literal } = require("sequelize");
const PermissionService = require("../services/permission.service");
const {
  sendSubAdminCreatedNotification,
} = require("../services/email.service");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const bcrypt = require("bcryptjs");

/**
 * Create a new sub-admin user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const createSubAdmin = catchAsync(async (req, res, next) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    password,
    role_id,
    permission_ids,
    permission_groups,
  } = req.body;

  // Start database transaction
  const transaction = await sequelize.transaction();

  try {
    // Check if email already exists (outside transaction for performance)
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return next(new AppError("User with this email already exists", 409));
    }

    // Check if phone already exists (outside transaction for performance)
    if (phone) {
      const existingPhone = await User.findOne({ where: { phone } });
      if (existingPhone) {
        return next(
          new AppError("User with this phone number already exists", 409)
        );
      }
    }

    // Verify role exists and is not admin (outside transaction for performance)
    if (role_id) {
      const role = await Role.findByPk(role_id);
      if (!role) {
        return next(new AppError("Role not found", 404));
      }
      if (role.name === "admin") {
        return next(new AppError("Cannot create sub-admin with admin role", 400));
      }
    }

    // Hash password (outside transaction for security)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user within transaction
    const user = await User.create({
      first_name,
      last_name,
      email,
      phone,
      password: hashedPassword,
      is_active: true,
    }, { transaction });

    // Assign role if provided within transaction
    if (role_id) {
      await UserRole.create({
        user_id: user.id,
        role_id: role_id,
      }, { transaction });

      // Assign permissions to role if provided within transaction
      if (permission_groups && permission_groups.length > 0) {
        // Assign permissions by groups
        await PermissionService.assignPermissionsByGroups(
          role_id,
          permission_groups,
          transaction
        );
      } else if (permission_ids && permission_ids.length > 0) {
        // Assign individual permissions (backward compatibility)
        await PermissionService.assignPermissionsToRole(
          role_id,
          permission_ids,
          transaction
        );
      }
    }

    // Commit the transaction before loading user details
    await transaction.commit();

    // Load user with roles and permissions (outside transaction)
    const userWithDetails = await User.findByPk(user.id, {
      include: [
        {
          model: Role,
          as: "roles",
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
          through: { attributes: [] },
        },
      ],
    });

    // Remove password from response
    const userResponse = { ...userWithDetails.toJSON() };
    delete userResponse.password;

    // Send response first
    res.status(201).json({
      status: "success",
      message: "Sub-admin created successfully",
      data: {
        user: userResponse,
      },
    });

    // Send email notification asynchronously (don't block response)
    try {
      const roleName = userWithDetails.roles?.[0]?.name || "Sub-Admin";
      const permissions = userWithDetails.roles?.[0]?.permissions || [];

      await sendSubAdminCreatedNotification({
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        roleName: roleName,
        permissions: permissions.map((p) => ({
          resource: p.resource,
          action: p.action,
          description: p.description,
        })),
        createdAt: user.created_at,
      });
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error("Failed to send sub-admin creation email:", emailError);
    }
  } catch (error) {
    // Rollback transaction on any error
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      console.error("Error rolling back transaction:", rollbackError);
    }

    // Return error response
    return next(error);
  }
});

/**
 * Get all sub-admins (non-admin users with admin-like roles)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const getSubAdmins = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, search } = req.query;

  const offset = (page - 1) * limit;

  // Build where clause
  const whereClause = {
    [Op.and]: [
      // Exclude admin role users
      literal(`
        User.id NOT IN (
          SELECT ur.user_id FROM user_roles ur
          INNER JOIN roles r ON ur.role_id = r.id
          WHERE r.name = 'admin'
        )
      `),
      // Include only users with roles that have permissions
      literal(`
        User.id IN (
          SELECT DISTINCT ur.user_id FROM user_roles ur
          INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
        )
      `),
    ],
  };

  // Add search functionality
  if (search) {
    whereClause[Op.or] = [
      { first_name: { [Op.like]: `%${search}%` } },
      { last_name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows: users } = await User.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: Role,
        as: "roles",
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] },
          },
        ],
        through: { attributes: [] },
      },
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["created_at", "DESC"]],
    distinct: true,
  });

  // Remove passwords from response
  const usersResponse = users.map((user) => {
    const userJson = user.toJSON();
    delete userJson.password;
    return userJson;
  });

  res.status(200).json({
    status: "success",
    data: {
      subAdmins: usersResponse,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    },
  });
});

/**
 * Get a specific sub-admin by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const getSubAdmin = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findByPk(id, {
    include: [
      {
        model: Role,
        as: "roles",
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] },
          },
        ],
        through: { attributes: [] },
      },
    ],
  });

  if (!user) {
    return next(new AppError("Sub-admin not found", 404));
  }

  // Check if user is actually a sub-admin (not admin)
  const hasAdminRole = user.roles?.some((role) => role.name === "admin");
  if (hasAdminRole) {
    return next(new AppError("User is an admin, not a sub-admin", 400));
  }

  // Remove password from response
  const userResponse = { ...user.toJSON() };
  delete userResponse.password;

  res.status(200).json({
    status: "success",
    data: {
      subAdmin: userResponse,
    },
  });
});

/**
 * Update sub-admin permissions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const updateSubAdminPermissions = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { role_id, permission_ids, permission_groups } = req.body;

  // Start database transaction
  const transaction = await sequelize.transaction();

  try {
    const user = await User.findByPk(id, {
      include: [
        {
          model: Role,
          as: "roles",
        },
      ],
      transaction,
    });

    if (!user) {
      return next(new AppError("Sub-admin not found", 404));
    }

    // Check if user is actually a sub-admin (not admin)
    const hasAdminRole = user.roles?.some((role) => role.name === "admin");
    if (hasAdminRole) {
      return next(new AppError("Cannot modify admin user permissions", 400));
    }

    // Update role if provided within transaction
    if (role_id) {
      const role = await Role.findByPk(role_id, { transaction });
      if (!role) {
        return next(new AppError("Role not found", 404));
      }
      if (role.name === "admin") {
        return next(new AppError("Cannot assign admin role to sub-admin", 400));
      }

      // Remove existing role assignment
      await UserRole.destroy({ where: { user_id: id }, transaction });

      // Assign new role
      await UserRole.create({
        user_id: id,
        role_id: role_id,
      }, { transaction });
    }

    // Update permissions if provided within transaction
    if (permission_groups !== undefined || permission_ids !== undefined) {
      // Get user's current role
      const userRole = await UserRole.findOne({ where: { user_id: id }, transaction });
      if (userRole) {
        if (permission_groups && permission_groups.length > 0) {
          // Assign permissions by groups
          await PermissionService.assignPermissionsByGroups(
            userRole.role_id,
            permission_groups,
            transaction
          );
        } else if (permission_ids && permission_ids.length > 0) {
          // Assign individual permissions (backward compatibility)
          await PermissionService.assignPermissionsToRole(
            userRole.role_id,
            permission_ids,
            transaction
          );
        } else {
          // Remove all permissions from role
          await RolePermission.destroy({ where: { role_id: userRole.role_id }, transaction });
        }
      }
    }

    // Commit the transaction
    await transaction.commit();

    // Load updated user with roles and permissions (outside transaction)
    const updatedUser = await User.findByPk(id, {
      include: [
        {
          model: Role,
          as: "roles",
          include: [
            {
              model: Permission,
              as: "permissions",
              through: { attributes: [] },
            },
          ],
          through: { attributes: [] },
        },
      ],
    });

    // Remove password from response
    const userResponse = { ...updatedUser.toJSON() };
    delete userResponse.password;

    res.status(200).json({
      status: "success",
      message: "Sub-admin permissions updated successfully",
      data: {
        subAdmin: userResponse,
      },
    });
  } catch (error) {
    // Rollback transaction on any error
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rollbackError) {
      console.error("Error rolling back transaction:", rollbackError);
    }

    // Return error response
    return next(error);
  }
});

/**
 * Update sub-admin profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const updateSubAdmin = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { first_name, last_name, phone, is_active } = req.body;

  const user = await User.findByPk(id);
  if (!user) {
    return next(new AppError("Sub-admin not found", 404));
  }

  // Check if user is actually a sub-admin (not admin)
  const userRole = await UserRole.findOne({
    where: { user_id: id },
    include: [{ model: Role, as: "role" }],
  });

  if (userRole && userRole.role.name === "admin") {
    return next(new AppError("Cannot modify admin user", 400));
  }

  // Check phone uniqueness if updating phone
  if (phone && phone !== user.phone) {
    const existingPhone = await User.findOne({ where: { phone } });
    if (existingPhone) {
      return next(new AppError("Phone number already in use", 409));
    }
  }

  // Update user
  await user.update({
    first_name: first_name || user.first_name,
    last_name: last_name || user.last_name,
    phone: phone || user.phone,
    is_active: is_active !== undefined ? is_active : user.is_active,
  });

  // Load updated user with roles and permissions
  const updatedUser = await User.findByPk(id, {
    include: [
      {
        model: Role,
        as: "roles",
        include: [
          {
            model: Permission,
            as: "permissions",
            through: { attributes: [] },
          },
        ],
        through: { attributes: [] },
      },
    ],
  });

  // Remove password from response
  const userResponse = { ...updatedUser.toJSON() };
  delete userResponse.password;

  res.status(200).json({
    status: "success",
    message: "Sub-admin updated successfully",
    data: {
      subAdmin: userResponse,
    },
  });
});

/**
 * Delete a sub-admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const deleteSubAdmin = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findByPk(id);
  if (!user) {
    return next(new AppError("Sub-admin not found", 404));
  }

  // Check if user is actually a sub-admin (not admin)
  const userRole = await UserRole.findOne({
    where: { user_id: id },
    include: [{ model: Role, as: "role" }],
  });

  if (userRole && userRole.role.name === "admin") {
    return next(new AppError("Cannot delete admin user", 400));
  }

  // Soft delete by deactivating
  await user.update({ is_active: false });

  res.status(200).json({
    status: "success",
    message: "Sub-admin deactivated successfully",
  });
});

/**
 * Get all available permissions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const getPermissions = catchAsync(async (req, res, next) => {
  const permissions = await PermissionService.getAllPermissions();

  res.status(200).json({
    status: "success",
    data: {
      permissions,
    },
  });
});

/**
 * Get all available roles (excluding admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const getRoles = catchAsync(async (req, res, next) => {
  const roles = await Role.findAll({
    where: {
      name: { [Op.ne]: "admin" },
    },
    include: [
      {
        model: Permission,
        as: "permissions",
        through: { attributes: [] },
      },
    ],
  });

  res.status(200).json({
    status: "success",
    data: {
      roles,
    },
  });
});

/**
 * Get all available permission groups
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const getPermissionGroups = catchAsync(async (req, res, next) => {
  const { includeIds = false } = req.query;

  const groups = await PermissionService.getPermissionGroups({
    includeIds: includeIds === 'true'
  });

  res.status(200).json({
    status: "success",
    data: {
      permissionGroups: groups,
    },
  });
});

module.exports = {
  createSubAdmin,
  getSubAdmins,
  getSubAdmin,
  updateSubAdminPermissions,
  updateSubAdmin,
  deleteSubAdmin,
  getPermissions,
  getRoles,
  getPermissionGroups,
};
