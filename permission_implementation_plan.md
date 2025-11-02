# Implementation Plan

## Overview

Implement a comprehensive Spatie-like permission system that provides fine-grained access control through permissions, roles, and user permission assignments. This system will extend the existing role-based access control to include granular permissions while maintaining backward compatibility with current role checks.

The permission system will support both role-based and direct user permission assignments, resource ownership checks, and comprehensive permission management through a new Permission model, PermissionRole junction table, and PermissionUser junction table. This implementation will enhance security and provide more precise access control for the e-commerce platform.

## Types

Define new Sequelize models and data structures for the permission system:

**Permission Model:**
```javascript
{
  id: BIGINT PRIMARY KEY AUTO_INCREMENT,
  name: STRING(100) UNIQUE NOT NULL, // e.g., 'manage_products'
  slug: STRING(100) UNIQUE NOT NULL, // e.g., 'manage-products' 
  description: TEXT, // Human-readable description
  resource: STRING(50) NOT NULL, // e.g., 'products', 'orders'
  action: STRING(50) NOT NULL, // e.g., 'create', 'read', 'update', 'delete'
  created_at: DATE DEFAULT CURRENT_TIMESTAMP,
  updated_at: DATE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
}
```

**PermissionRole Model (Junction):**
```javascript
{
  id: BIGINT PRIMARY KEY AUTO_INCREMENT,
  permission_id: BIGINT NOT NULL REFERENCES permissions(id),
  role_id: BIGINT NOT NULL REFERENCES roles(id),
  created_at: DATE DEFAULT CURRENT_TIMESTAMP,
  updated_at: DATE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
}
```

**PermissionUser Model (Junction):**
```javascript
{
  id: BIGINT PRIMARY KEY AUTO_INCREMENT,
  permission_id: BIGINT NOT NULL REFERENCES permissions(id),
  user_id: BIGINT NOT NULL REFERENCES users(id),
  created_at: DATE DEFAULT CURRENT_TIMESTAMP,
  updated_at: DATE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
}
```

**Enhanced User Model Methods:**
- `hasPermission(permissionName)` - Check if user has specific permission
- `hasPermissionTo(resource, action)` - Check permission for specific resource/action
- `hasAnyPermission(permissionNames)` - Check if user has any of the specified permissions
- `hasAllPermissions(permissionNames)` - Check if user has all specified permissions
- `givePermissionTo(permission)` - Grant permission to user
- `revokePermissionTo(permission)` - Revoke permission from user
- `can(resource, action)` - Quick check for resource/action permission

## Files

### New Files to Create:

**Models:**
- `models/permission.model.js` - Permission Sequelize model
- `models/permission-role.model.js` - Permission-Role junction model  
- `models/permission-user.model.js` - Permission-User junction model

**Controllers:**
- `controllers/permission.controller.js` - CRUD operations for permissions

**Routes:**
- `routes/permission.route.js` - Permission management routes

**Middleware:**
- `middlewares/permission.js` - Permission checking middleware
- `utils/permission-helpers.js` - Permission utility functions

**Migrations:**
- `migrations/YYYYMMDDHHMMSS-create-permission-system.js` - Create permission tables
- `migrations/YYYYMMDDHHMMSS-seed-default-permissions.js` - Seed default permissions

**Seeders:**
- `seeders/YYYYMMDDHHMMSS-seed-permissions.js` - Seed permission data

**Services:**
- `services/permission.service.js` - Business logic for permission operations

### Existing Files to Modify:

**Models:**
- `models/user.model.js` - Add permission-related instance methods
- `models/role.model.js` - Add permission associations

**Controllers:**
- `controllers/role.controller.js` - Add role-permission management endpoints

**Routes:**
- `routes/role.route.js` - Add role-permission management routes

**Middleware:**
- `middlewares/auth.js` - Add permission checking middleware functions

**Configuration:**
- `models/index.js` - Register new models with Sequelize

## Functions

### New Functions:

**Permission Service Functions:**
- `createPermission(data)` - Create new permission
- `getAllPermissions(options)` - Retrieve all permissions with filtering
- `getPermission(id)` - Get single permission by ID
- `updatePermission(id, data)` - Update permission
- `deletePermission(id)` - Delete permission
- `assignPermissionToRole(permissionId, roleId)` - Assign permission to role
- `removePermissionFromRole(permissionId, roleId)` - Remove permission from role
- `assignPermissionToUser(permissionId, userId)` - Assign permission directly to user
- `removePermissionFromUser(permissionId, userId)` - Remove direct permission from user
- `getUserPermissions(userId)` - Get all permissions for user (including role-based)
- `hasPermission(userId, permissionName)` - Check if user has permission
- `seedDefaultPermissions()` - Create default permission set

**User Model Instance Methods:**
- `async hasPermission(permissionName)` - Check if user has specific permission
- `async hasPermissionTo(resource, action)` - Check permission for resource/action
- `async hasAnyPermission(permissionNames)` - Check any permissions
- `async hasAllPermissions(permissionNames)` - Check all permissions
- `async givePermissionTo(permission)` - Grant permission to user
- `async revokePermissionTo(permission)` - Revoke permission from user
- `can(resource, action)` - Quick resource/action check
- `getAllPermissions()` - Get all user permissions

**Middleware Functions:**
- `hasPermission(permissionName)` - Middleware to check specific permission
- `hasAnyPermission(permissionNames)` - Middleware to check any permissions
- `hasAllPermissions(permissionNames)` - Middleware to check all permissions
- `hasPermissionTo(resource, action)` - Middleware to check resource/action
- `can(resource, action)` - Quick resource/action check middleware

**Controller Functions:**
- `getAllPermissions(req, res, next)` - GET /api/v1/permissions
- `getPermission(req, res, next)` - GET /api/v1/permissions/:id
- `createPermission(req, res, next)` - POST /api/v1/permissions
- `updatePermission(req, res, next)` - PATCH /api/v1/permissions/:id
- `deletePermission(req, res, next)` - DELETE /api/v1/permissions/:id
- `assignPermissionToRole(req, res, next)` - POST /api/v1/permissions/:id/roles
- `removePermissionFromRole(req, res, next)` - DELETE /api/v1/permissions/:id/roles/:roleId
- `getRolePermissions(req, res, next)` - GET /api/v1/roles/:id/permissions
- `assignPermissionToUser(req, res, next)` - POST /api/v1/permissions/:id/users
- `removePermissionFromUser(req, res, next)` - DELETE /api/v1/permissions/:id/users/:userId
- `getUserPermissions(req, res, next)` - GET /api/v1/users/:id/permissions

### Modified Functions:

**Role Controller:**
- Add role-permission management endpoints to existing controller

**Auth Middleware:**
- Enhance existing role checking functions with permission support
- Add permission checking as additional authorization layer

## Classes

### New Classes:

**Permission Model Class:**
- Sequelize model representing system permissions
- Includes validation, associations, and helper methods
- Supports resource-action based permission naming

**PermissionRole Model Class:**
- Junction table model for role-permission many-to-many relationship
- Includes composite unique constraint to prevent duplicates

**PermissionUser Model Class:**  
- Junction table model for user-permission direct assignments
- Allows bypassing role system for specific user permissions

**PermissionService Class:**
- Service layer handling all permission business logic
- Provides centralized permission management operations
- Includes caching and optimization methods

**PermissionController Class:**
- REST API controller for permission management
- Handles CRUD operations and permission assignments
- Includes comprehensive error handling and validation

### Modified Classes:

**User Model Class:**
- Add permission-related instance methods
- Enhance with permission checking capabilities
- Maintain backward compatibility with existing role methods

**Role Model Class:**
- Add permission associations
- Support role-permission many-to-many relationship
- Add helper methods for permission management

## Dependencies

### New Dependencies:

No new package dependencies required. The implementation uses existing Sequelize and Express infrastructure.

### Modified Dependencies:

No existing dependencies need modification. The system extends current functionality without breaking changes.

### Integration Requirements:

- Sequelize ORM integration with existing database schema
- Express middleware integration with current authentication system
- Passport.js integration for permission-based route protection
- Winston logger integration for permission operation logging
- Existing validation middleware integration

## Testing

### Test File Requirements:

**Unit Tests:**
- `test/models/permission.test.js` - Permission model tests
- `test/models/permission-role.test.js` - PermissionRole junction tests  
- `test/models/permission-user.test.js` - PermissionUser junction tests
- `test/services/permission.service.test.js` - Permission service tests
- `test/middlewares/permission.test.js` - Permission middleware tests

**Integration Tests:**
- `test/controllers/permission.controller.test.js` - Permission controller tests
- `test/integration/permission-system.test.js` - End-to-end permission tests

**Feature Tests:**
- `test/features/permission-assignment.test.js` - Permission assignment workflows
- `test/features/permission-inheritance.test.js` - Role-based permission inheritance
- `test/features/permission-middleware.test.js` - Middleware protection tests

### Existing Test Modifications:

- Update existing auth middleware tests to include permission checks
- Modify role controller tests to include permission management
- Enhance user model tests with permission method testing

### Validation Strategies:

- Database constraint validation testing
- Permission inheritance chain testing
- Middleware authorization flow testing
- Performance testing for permission queries
- Security testing for permission bypass attempts

## Implementation Order

1. **Database Schema Creation**
   - Run permission system migration to create new tables
   - Verify table creation and constraints
   - Test foreign key relationships

2. **Model Implementation**
   - Create Permission, PermissionRole, and PermissionUser models
   - Define associations and validations
   - Register models with Sequelize

3. **Service Layer Development**
   - Implement PermissionService with all business logic
   - Add permission seeding functionality
   - Implement caching and optimization

4. **Middleware Implementation**
   - Create permission checking middleware
   - Add resource-action based checking
   - Integrate with existing auth system

5. **User Model Enhancement**
   - Add permission instance methods to User model
   - Maintain backward compatibility with role methods
   - Add permission caching for performance

6. **Controller and Routes**
   - Create PermissionController with CRUD operations
   - Add role-permission management endpoints
   - Create permission route definitions

7. **Default Permission Seeding**
   - Create seed data for common e-commerce permissions
   - Assign default permissions to existing roles
   - Test permission inheritance

8. **Integration and Testing**
   - Update existing routes to use permission middleware
   - Run comprehensive tests
   - Performance optimization and caching

9. **Documentation and Migration Guide**
   - Update API documentation
   - Create migration guide for existing code
   - Add code examples and best practices

The implementation order ensures minimal disruption to existing functionality while building a robust permission system that follows Laravel Spatie patterns adapted for Node.js/Express/Sequelize stack.
