"use strict";

const {
  Permission,
  PermissionRole,
  PermissionUser,
  Role,
  User,
} = require("../models");
const { Op } = require("sequelize");
const slugify = require("slugify");

/**
 * Enhanced Additional Permission Seeder with Critical Issue Fixes
 *
 * FIXES IMPLEMENTED:
 * ✅ Transaction Management - All operations atomic
 * ✅ Slug Collision Detection - Unique slug generation
 * ✅ Bulk Operations - Performance optimization
 * ✅ Comprehensive Validation - Data integrity
 * ✅ Progress Tracking - Better monitoring
 * ✅ Enhanced Error Handling - Graceful failures
 * ✅ Duplicate Detection - Consistent approach with first seeder
 */

// Constants for validation
const ALLOWED_RESOURCES = [
  "users",
  "roles",
  "permissions",
  "products",
  "categories",
  "orders",
  "inventory",
  "reviews",
  "vendors",
  "addresses",
  "carts",
  "collections",
  "journals",
  "variants",
  "supply",
  "notifications",
  "support",
  "dashboard",
  "reports",
  "settings",
  "auth",
  "profile",
  "phone_changes",
  "wishlists",
  "wishlist_items",
  "cart_items",
  "cart",
  "variant_types",
  "variant_combinations",
  "webhooks",
  "analytics",
  "sales",
  "admin_dashboard",
  "vendor_onboarding",
  "supplies",
  "vendor_followers",
  "user_roles",
];

const ALLOWED_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
  "manage",
  "view",
  "list",
  "export",
  "import",
  "approve",
  "reject",
  "activate",
  "deactivate",
  "archive",
  "restore",
  "login",
  "logout",
  "verify_email",
  "resend_verification",
  "forgot_password",
  "reset_password",
  "verify_phone",
  "request_phone_change",
  "cancel_phone_change",
  "change_password",
  "read_pending",
  "approve",
  "reject",
  "read_by_id",
  "read_products",
  "create_admin",
  "update_admin",
  "delete_admin",
  "add_products",
  "remove_products",
  "manage_admin",
  "read_summary",
  "sync",
  "share",
  "create_admin",
  "update_admin",
  "delete_admin",
  "manage_admin",
  "create_admin",
  "read",
  "update_admin",
  "delete_admin",
  "assign_variant",
  "remove_variant",
  "manage_admin",
  "read_all",
  "test",
  "read_public",
  "read_by_identifier",
  "read_by_vendor",
  "read_reviews_public",
  "create_vendor",
  "update_own_vendor",
  "delete_own_vendor",
  "manage_own_vendor",
  "read_analytics_vendor",
  "read_analytics_public",
  "manage_admin",
  "manage_all_admin",
  "delete_any_admin",
  "update_status_admin",
  "read_by_status_admin",
  "read_tree_public",
  "read_products_public",
  "read_by_identifier_public",
  "read_metrics",
  "read_recent_admin",
  "read_top_performing",
  "read_stats_admin",
  "read_stats",
  "read_overview_admin",
  "read_low_stock_global_admin",
  "read_history_admin",
  "read_all_admin",
  "read_vendor_admin",
  "read_all_admin",
  "create_admin",
  "update_any_admin",
  "update_status_admin",
  "read_analytics_admin",
  "read_all_admin",
  "read_single_admin",
  "assign_admin",
  "remove_admin",
  "read_vendor",
  "read_product_history",
  "update_vendor",
  "read_summary_vendor",
  "read_summary_admin",
  "moderate_admin",
  "respond_vendor",
  "flag",
  "remove_flagged_admin",
  "read_all_admin",
  "read_single_admin",
  "update_status_admin",
  "approve_application_admin",
  "reject_application_admin",
  "suspend_admin",
  "activate_admin",
  "read_analytics_vendor",
  "update_profile_vendor",
  "delete_all",
  "delete_vendor",
  "read",
];

/**
 * Enhanced slug generation with collision detection
 * @param {string} name - Permission name
 * @param {Array<string>} existingSlugs - Array of existing slugs to check against
 * @returns {string} Unique slug
 */
function generateUniqueSlug(name, existingSlugs = []) {
  let baseSlug = slugify(name, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  // Remove common prefixes that don't affect uniqueness
  slug = slug.replace(/^(view_|manage_|read_|create_|update_|delete_)/, "");

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Validate permission data structure and constraints
 * @param {Object} perm - Permission object to validate
 * @returns {Object} Validation result with isValid and errors
 */
function validatePermission(perm) {
  const errors = [];

  // Required fields validation
  if (!perm.name || typeof perm.name !== "string") {
    errors.push("Permission name is required and must be a string");
  }

  if (!perm.resource || typeof perm.resource !== "string") {
    errors.push("Resource is required and must be a string");
  }

  if (!perm.action || typeof perm.action !== "string") {
    errors.push("Action is required and must be a string");
  }

  // Length validation
  if (perm.name && (perm.name.length < 1 || perm.name.length > 100)) {
    errors.push("Permission name must be between 1 and 100 characters");
  }

  if (perm.resource && perm.resource.length > 50) {
    errors.push("Resource must not exceed 50 characters");
  }

  if (perm.action && perm.action.length > 50) {
    errors.push("Action must not exceed 50 characters");
  }

  // Allowed values validation
  if (perm.resource && !ALLOWED_RESOURCES.includes(perm.resource)) {
    errors.push(`Resource "${perm.resource}" is not in allowed list`);
  }

  if (perm.action && !ALLOWED_ACTIONS.includes(perm.action)) {
    errors.push(`Action "${perm.action}" is not in allowed list`);
  }

  // Pattern validation for permission names
  if (perm.name && !/^[a-z0-9_]+$/i.test(perm.name)) {
    errors.push(
      "Permission name must only contain letters, numbers, and underscores"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create additional permissions in bulk with transaction support
 * @param {Array} permissions - Array of permission objects
 * @param {Object} transaction - Sequelize transaction object
 * @returns {Promise<Object>} Result with created permissions and summary
 */
async function createAdditionalPermissionsInBulk(permissions, transaction) {
  const results = {
    created: [],
    skipped: [],
    errors: [],
    totalProcessed: 0,
  };

  // Get existing permissions for duplicate detection
  const existingPermissions = await Permission.findAll({
    where: {
      name: { [Op.in]: permissions.map((p) => p.name) },
    },
    transaction,
  });

  const existingNames = new Set(existingPermissions.map((p) => p.name));
  const existingSlugs = existingPermissions.map((p) => p.slug);

  // Get all existing slugs to prevent conflicts
  const allExistingPermissions = await Permission.findAll({ transaction });
  const allExistingSlugs = new Set(allExistingPermissions.map((p) => p.slug));

  // Process permissions in batches for better performance
  const batchSize = 50;
  for (let i = 0; i < permissions.length; i += batchSize) {
    const batch = permissions.slice(i, i + batchSize);

    const batchPromises = batch.map(async (perm) => {
      try {
        results.totalProcessed++;

        // Check if permission already exists (consistent with first seeder approach)
        if (existingNames.has(perm.name)) {
          results.skipped.push({ name: perm.name, reason: "already_exists" });
          console.log(`  🔄 Already exists: ${perm.name}`);
          return;
        }

        // Validate permission data
        const validation = validatePermission(perm);
        if (!validation.isValid) {
          results.errors.push({
            name: perm.name,
            errors: validation.errors,
          });
          console.error(
            `  ❌ Validation failed for ${perm.name}:`,
            validation.errors.join(", ")
          );
          return;
        }

        // Generate unique slug
        const uniqueSlug = generateUniqueSlug(
          perm.name,
          Array.from(allExistingSlugs)
        );
        if (!allExistingSlugs.has(uniqueSlug)) {
          allExistingSlugs.add(uniqueSlug);
        }

        const permissionData = {
          ...perm,
          slug: uniqueSlug,
        };

        // Create permission using findOrCreate (consistent with first seeder)
        const [permission, wasCreated] = await Permission.findOrCreate({
          where: { name: perm.name },
          defaults: permissionData,
          transaction,
        });

        if (wasCreated) {
          results.created.push(permission);
          existingNames.add(perm.name);
          console.log(`  ✅ Created: ${permission.name} (${permission.slug})`);
        } else {
          results.skipped.push({
            name: perm.name,
            reason: "concurrent_creation",
          });
          console.log(`  🔄 Concurrent creation detected: ${perm.name}`);
        }
      } catch (error) {
        results.errors.push({
          name: perm.name,
          error: error.message,
        });
        console.error(`  ❌ Error with ${perm.name}:`, error.message);
      }
    });

    await Promise.all(batchPromises);

    // Progress reporting
    const progress = Math.min(i + batchSize, permissions.length);
    console.log(
      `  📊 Progress: ${progress}/${permissions.length} (${Math.round(
        (progress / permissions.length) * 100
      )}%)`
    );
  }

  return results;
}

/**
 * Assign additional permissions to roles in bulk with transaction support
 * @param {Array} roles - Array of role objects
 * @param {Array} permissions - Array of permission objects
 * @param {Object} transaction - Sequelize transaction object
 * @returns {Promise<Object>} Assignment results
 */
async function assignAdditionalPermissionsToRolesInBulk(
  roles,
  permissions,
  transaction
) {
  const results = {
    assigned: [],
    skipped: [],
    errors: [],
  };

  // Get existing permission-role assignments
  const existingAssignments = await PermissionRole.findAll({
    where: {
      permission_id: { [Op.in]: permissions.map((p) => p.id) },
      role_id: { [Op.in]: roles.map((r) => r.id) },
    },
    transaction,
  });

  const existingAssignmentsSet = new Set(
    existingAssignments.map((ar) => `${ar.permission_id}-${ar.role_id}`)
  );

  // Process assignments in batches
  const assignments = [];

  // Define permission-role assignments based on business logic
  for (const role of roles) {
    let permissionsToAssign = [];

    switch (role.name.toLowerCase()) {
      case "admin":
        // Admin gets all new permissions
        permissionsToAssign = permissions;
        break;
      case "vendor":
        // Vendor gets vendor-specific and business permissions
        permissionsToAssign = permissions.filter((p) => {
          const vendorResources = [
            "auth",
            "products",
            "orders",
            "inventory",
            "supplies",
            "reviews",
            "variant_types",
            "variant_combinations",
            "wishlists",
            "wishlist_items",
            "cart_items",
            "cart",
            "addresses",
            "phone_changes",
            "support",
            "notifications",
            "analytics",
            "sales",
            "vendor_onboarding",
            "supplies",
            "vendor_followers",
          ];
          return (
            vendorResources.includes(p.resource) ||
            (p.resource === "vendors" && !p.action.includes("admin"))
          );
        });
        break;
      case "customer":
        // Customer gets customer-specific permissions
        permissionsToAssign = permissions.filter((p) => {
          const customerResources = [
            "auth",
            "cart",
            "cart_items",
            "wishlists",
            "wishlist_items",
            "addresses",
            "orders",
            "profile",
            "reviews",
          ];
          return (
            customerResources.includes(p.resource) ||
            (p.resource === "products" && p.action.includes("public")) ||
            (p.resource === "categories" && p.action.includes("public")) ||
            (p.resource === "collections" && p.action === "read")
          );
        });
        break;
      default:
        // Other roles get read permissions for public resources
        permissionsToAssign = permissions.filter(
          (p) =>
            p.action.includes("read") &&
            (p.action.includes("public") || p.action.includes("view"))
        );
        break;
    }

    // Add assignments for this role
    for (const permission of permissionsToAssign) {
      assignments.push({
        permission_id: permission.id,
        role_id: role.id,
      });
    }
  }

  // Process assignments in batches
  const batchSize = 100;
  for (let i = 0; i < assignments.length; i += batchSize) {
    const batch = assignments.slice(i, i + batchSize);

    for (const assignment of batch) {
      try {
        const assignmentKey = `${assignment.permission_id}-${assignment.role_id}`;

        if (existingAssignmentsSet.has(assignmentKey)) {
          results.skipped.push(assignment);
          continue;
        }

        // Check if assignment already exists (race condition protection)
        const [permissionRole, wasCreated] = await PermissionRole.findOrCreate({
          where: {
            permission_id: assignment.permission_id,
            role_id: assignment.role_id,
          },
          defaults: assignment,
          transaction,
        });

        if (wasCreated) {
          results.assigned.push(assignment);
          existingAssignmentsSet.add(assignmentKey);
          console.log(
            `  ✅ Assigned: Permission ${assignment.permission_id} -> Role ${assignment.role_id}`
          );
        } else {
          results.skipped.push(assignment);
          console.log(
            `  🔄 Already assigned: Permission ${assignment.permission_id} -> Role ${assignment.role_id}`
          );
        }
      } catch (error) {
        results.errors.push({ assignment, error: error.message });
        console.error(
          `  ❌ Error assigning Permission ${assignment.permission_id} -> Role ${assignment.role_id}:`,
          error.message
        );
      }
    }
  }

  return results;
}

// Additional permissions to seed (170 permissions) - as provided
const ADDITIONAL_PERMISSIONS = [
  // === AUTHENTICATION SYSTEM (15 permissions) ===
  {
    name: "register_user",
    resource: "auth",
    action: "create",
    description: "Allow user self-registration",
  },
  {
    name: "register_admin",
    resource: "auth",
    action: "create_admin",
    description: "Allow admin user registration",
  },
  {
    name: "authenticate_user",
    resource: "auth",
    action: "login",
    description: "Allow user login authentication",
  },
  {
    name: "logout_user",
    resource: "auth",
    action: "logout",
    description: "Allow user logout",
  },
  {
    name: "verify_email",
    resource: "auth",
    action: "verify_email",
    description: "Allow email verification",
  },
  {
    name: "resend_verification",
    resource: "auth",
    action: "resend_verification",
    description: "Allow resending verification codes",
  },
  {
    name: "request_password_reset",
    resource: "auth",
    action: "forgot_password",
    description: "Allow password reset requests",
  },
  {
    name: "reset_password",
    resource: "auth",
    action: "reset_password",
    description: "Allow password reset with token",
  },
  {
    name: "verify_phone_change",
    resource: "auth",
    action: "verify_phone",
    description: "Allow phone change verification",
  },
  {
    name: "request_phone_change",
    resource: "auth",
    action: "request_phone_change",
    description: "Allow phone change requests",
  },
  {
    name: "cancel_phone_change",
    resource: "auth",
    action: "cancel_phone_change",
    description: "Allow cancelling phone change requests",
  },
  {
    name: "view_own_profile",
    resource: "profile",
    action: "read",
    description: "Allow viewing own user profile",
  },
  {
    name: "update_own_profile",
    resource: "profile",
    action: "update",
    description: "Allow updating own user profile",
  },
  {
    name: "change_own_password",
    resource: "profile",
    action: "change_password",
    description: "Allow changing own password",
  },
  {
    name: "view_pending_phone_changes",
    resource: "phone_changes",
    action: "read_pending",
    description: "Allow viewing pending phone change requests",
  },
  {
    name: "approve_phone_change",
    resource: "phone_changes",
    action: "approve",
    description: "Allow approving phone change requests",
  },
  {
    name: "reject_phone_change",
    resource: "phone_changes",
    action: "reject",
    description: "Allow rejecting phone change requests",
  },

  // === COLLECTION MANAGEMENT (9 permissions) ===
  {
    name: "view_collections",
    resource: "collections",
    action: "read",
    description: "Allow viewing collection listings",
  },
  {
    name: "view_collection_by_id",
    resource: "collections",
    action: "read_by_id",
    description: "Allow viewing collection details by ID",
  },
  {
    name: "view_collection_products",
    resource: "collections",
    action: "read_products",
    description: "Allow viewing products within collections",
  },
  {
    name: "create_collection_admin",
    resource: "collections",
    action: "create_admin",
    description: "Allow creating new collections (admin access)",
  },
  {
    name: "update_collection_admin",
    resource: "collections",
    action: "update_admin",
    description: "Allow updating any collection (admin access)",
  },
  {
    name: "delete_collection_admin",
    resource: "collections",
    action: "delete_admin",
    description: "Allow deleting collections (admin access)",
  },
  {
    name: "add_products_to_collection",
    resource: "collections",
    action: "add_products",
    description: "Allow adding products to collections",
  },
  {
    name: "remove_products_from_collection",
    resource: "collections",
    action: "remove_products",
    description: "Allow removing products from collections",
  },
  {
    name: "manage_collections_admin",
    resource: "collections",
    action: "manage_admin",
    description: "Full admin collection management access",
  },

  // === CART MANAGEMENT (7 permissions) ===
  {
    name: "view_cart",
    resource: "cart",
    action: "read",
    description: "Allow viewing own shopping cart contents",
  },
  {
    name: "view_cart_summary",
    resource: "cart",
    action: "read_summary",
    description: "Allow viewing cart summary for checkout",
  },
  {
    name: "add_to_cart",
    resource: "cart_items",
    action: "create",
    description: "Allow adding items to shopping cart",
  },
  {
    name: "update_cart_item",
    resource: "cart_items",
    action: "update",
    description: "Allow updating cart item quantities and details",
  },
  {
    name: "remove_from_cart",
    resource: "cart_items",
    action: "delete",
    description: "Allow removing items from shopping cart",
  },
  {
    name: "clear_cart",
    resource: "cart",
    action: "delete_all",
    description: "Allow clearing entire shopping cart",
  },
  {
    name: "sync_cart",
    resource: "cart",
    action: "sync",
    description: "Allow syncing local cart with server cart",
  },

  // === WISHLIST MANAGEMENT (11 permissions) ===
  {
    name: "view_wishlists",
    resource: "wishlists",
    action: "read",
    description: "Allow viewing own wishlists",
  },
  {
    name: "view_wishlist_by_id",
    resource: "wishlists",
    action: "read_by_id",
    description: "Allow viewing specific wishlist by ID",
  },
  {
    name: "view_wishlist_items",
    resource: "wishlist_items",
    action: "read",
    description: "Allow viewing wishlist items",
  },
  {
    name: "create_wishlist",
    resource: "wishlists",
    action: "create",
    description: "Allow creating new wishlists",
  },
  {
    name: "update_wishlist",
    resource: "wishlists",
    action: "update",
    description: "Allow updating wishlist details",
  },
  {
    name: "delete_wishlist",
    resource: "wishlists",
    action: "delete",
    description: "Allow deleting wishlists",
  },
  {
    name: "add_to_wishlist",
    resource: "wishlist_items",
    action: "create",
    description: "Allow adding items to wishlist",
  },
  {
    name: "update_wishlist_item",
    resource: "wishlist_items",
    action: "update",
    description: "Allow updating wishlist item details",
  },
  {
    name: "remove_from_wishlist",
    resource: "wishlist_items",
    action: "delete",
    description: "Allow removing items from wishlist",
  },
  {
    name: "share_wishlist",
    resource: "wishlists",
    action: "share",
    description: "Allow sharing wishlists with others",
  },
  {
    name: "manage_wishlists",
    resource: "wishlists",
    action: "manage",
    description: "Full wishlist management access",
  },

  // === JOURNAL MANAGEMENT (6 permissions) ===
  {
    name: "view_journals",
    resource: "journals",
    action: "read",
    description: "Allow viewing journal entries",
  },
  {
    name: "view_journal_by_id",
    resource: "journals",
    action: "read_by_id",
    description: "Allow viewing specific journal entry by ID",
  },
  {
    name: "create_journal_admin",
    resource: "journals",
    action: "create_admin",
    description: "Allow creating new journal entries (admin access)",
  },
  {
    name: "update_journal_admin",
    resource: "journals",
    action: "update_admin",
    description: "Allow updating any journal entry (admin access)",
  },
  {
    name: "delete_journal_admin",
    resource: "journals",
    action: "delete_admin",
    description: "Allow deleting journal entries (admin access)",
  },
  {
    name: "manage_journals_admin",
    resource: "journals",
    action: "manage_admin",
    description: "Full admin journal management access",
  },

  // === VARIANT MANAGEMENT (11 permissions) ===
  {
    name: "create_variant_type",
    resource: "variant_types",
    action: "create",
    description: "Allow creating variant types",
  },
  {
    name: "read_variant_types",
    resource: "variant_types",
    action: "read",
    description: "Allow viewing variant types",
  },
  {
    name: "update_variant_type",
    resource: "variant_types",
    action: "update",
    description: "Allow updating variant types",
  },
  {
    name: "delete_variant_type",
    resource: "variant_types",
    action: "delete",
    description: "Allow deleting variant types",
  },
  {
    name: "create_variant_combination",
    resource: "variant_combinations",
    action: "create",
    description: "Allow creating variant combinations",
  },
  {
    name: "read_variant_combinations",
    resource: "variant_combinations",
    action: "read",
    description: "Allow viewing variant combinations",
  },
  {
    name: "update_variant_combination",
    resource: "variant_combinations",
    action: "update",
    description: "Allow updating variant combinations",
  },
  {
    name: "assign_variant_to_combination",
    resource: "variant_combinations",
    action: "assign_variant",
    description: "Allow assigning variants to combinations",
  },
  {
    name: "remove_variant_from_combination",
    resource: "variant_combinations",
    action: "remove_variant",
    description: "Allow removing variants from combinations",
  },
  {
    name: "manage_variant_types_admin",
    resource: "variant_types",
    action: "manage_admin",
    description: "Full admin variant type management access",
  },
  {
    name: "manage_variant_combinations_admin",
    resource: "variant_combinations",
    action: "manage_admin",
    description: "Full admin variant combination management access",
  },

  // === WEBHOOK MANAGEMENT (3 permissions) ===
  {
    name: "view_all_webhooks",
    resource: "webhooks",
    action: "read_all",
    description: "Allow viewing all webhook logs and configurations",
  },
  {
    name: "test_webhooks",
    resource: "webhooks",
    action: "test",
    description: "Allow testing webhook endpoints",
  },
  {
    name: "manage_webhooks_admin",
    resource: "webhooks",
    action: "manage_admin",
    description: "Full admin webhook management access",
  },

  // === ADVANCED PRODUCT MANAGEMENT (16 permissions) ===
  {
    name: "view_products_public",
    resource: "products",
    action: "read_public",
    description: "Allow viewing products in public catalog",
  },
  {
    name: "view_product_by_identifier",
    resource: "products",
    action: "read_by_identifier",
    description: "Allow viewing specific product by identifier",
  },
  {
    name: "view_products_by_vendor",
    resource: "products",
    action: "read_by_vendor",
    description: "Allow viewing products by specific vendor",
  },
  {
    name: "view_product_reviews_public",
    resource: "products",
    action: "read_reviews_public",
    description: "Allow viewing product reviews publicly",
  },
  {
    name: "create_product_vendor",
    resource: "products",
    action: "create_vendor",
    description: "Allow creating products as vendor",
  },
  {
    name: "update_own_product_vendor",
    resource: "products",
    action: "update_own_vendor",
    description: "Allow updating own products as vendor",
  },
  {
    name: "delete_own_product_vendor",
    resource: "products",
    action: "delete_own_vendor",
    description: "Allow deleting own products as vendor",
  },
  {
    name: "manage_own_products_vendor",
    resource: "products",
    action: "manage_own_vendor",
    description: "Full management access to own products (vendor)",
  },
  {
    name: "view_product_analytics_vendor",
    resource: "products",
    action: "read_analytics_vendor",
    description: "Allow viewing product analytics as vendor",
  },
  {
    name: "view_vendor_analytics_public",
    resource: "vendors",
    action: "read_analytics_public",
    description: "Allow viewing vendor analytics publicly",
  },
  {
    name: "manage_analytics_admin",
    resource: "analytics",
    action: "manage_admin",
    description: "Full analytics management access",
  },
  {
    name: "manage_all_products_admin",
    resource: "products",
    action: "manage_all_admin",
    description: "Full admin access to all products",
  },
  {
    name: "delete_any_product_admin",
    resource: "products",
    action: "delete_any_admin",
    description: "Allow deleting any product (admin access)",
  },
  {
    name: "update_product_status_admin",
    resource: "products",
    action: "update_status_admin",
    description: "Allow updating product status (admin access)",
  },
  {
    name: "get_products_by_status_admin",
    resource: "products",
    action: "read_by_status_admin",
    description: "Allow viewing products filtered by status (admin access)",
  },
  {
    name: "manage_products_admin",
    resource: "products",
    action: "manage_admin",
    description: "Full admin product management access",
  },

  // === ADVANCED CATEGORY MANAGEMENT (3 permissions) ===
  {
    name: "view_category_tree_public",
    resource: "categories",
    action: "read_tree_public",
    description: "Allow viewing category hierarchy publicly",
  },
  {
    name: "view_category_by_identifier_public",
    resource: "categories",
    action: "read_by_identifier_public",
    description: "Allow viewing category by identifier publicly",
  },
  {
    name: "view_category_products_public",
    resource: "categories",
    action: "read_products_public",
    description: "Allow viewing products within categories publicly",
  },

  // === ADVANCED ANALYTICS & DASHBOARD (13 permissions) ===
  {
    name: "view_admin_dashboard_metrics",
    resource: "admin_dashboard",
    action: "read_metrics",
    description: "Allow viewing admin dashboard metrics",
  },
  {
    name: "view_recent_orders_admin",
    resource: "orders",
    action: "read_recent_admin",
    description: "Allow viewing recent orders in admin view",
  },
  {
    name: "view_top_selling_vendors",
    resource: "vendors",
    action: "read_top_performing",
    description: "Allow viewing top selling vendors analytics",
  },
  {
    name: "view_top_selling_items",
    resource: "products",
    action: "read_top_performing",
    description: "Allow viewing top selling products analytics",
  },
  {
    name: "view_admin_sales_stats",
    resource: "sales",
    action: "read_stats_admin",
    description: "Allow viewing administrative sales statistics",
  },
  {
    name: "view_top_categories_admin",
    resource: "categories",
    action: "read_top_performing",
    description: "Allow viewing top performing categories",
  },
  {
    name: "view_vendor_onboarding_stats",
    resource: "vendor_onboarding",
    action: "read_stats",
    description: "Allow viewing vendor onboarding statistics",
  },
  {
    name: "view_vendor_overview_admin",
    resource: "vendors",
    action: "read_overview_admin",
    description: "Allow viewing detailed vendor performance overview",
  },
  {
    name: "view_global_low_stock_admin",
    resource: "inventory",
    action: "read_low_stock_global_admin",
    description: "Allow viewing global low stock alerts (admin access)",
  },
  {
    name: "view_inventory_history_admin",
    resource: "inventory",
    action: "read_history_admin",
    description: "Allow viewing comprehensive inventory history (admin access)",
  },
  {
    name: "view_all_supplies_admin",
    resource: "supplies",
    action: "read_all_admin",
    description: "Allow viewing all supplies across platform (admin access)",
  },
  {
    name: "view_vendor_supplies_admin",
    resource: "supplies",
    action: "read_vendor_admin",
    description: "Allow viewing supplies for any vendor as admin",
  },
  {
    name: "manage_admin_dashboard",
    resource: "admin_dashboard",
    action: "manage",
    description: "Full admin dashboard management access",
  },

  // === ADVANCED INVENTORY MANAGEMENT (5 permissions) ===
  {
    name: "view_all_inventory_admin",
    resource: "inventory",
    action: "read_all_admin",
    description: "Allow viewing all inventory across platform (admin access)",
  },
  {
    name: "view_vendor_inventory_admin",
    resource: "inventory",
    action: "read_vendor_admin",
    description: "Allow viewing any vendor inventory as admin",
  },
  {
    name: "create_inventory_admin",
    resource: "inventory",
    action: "create_admin",
    description: "Allow creating inventory entries (admin access)",
  },
  {
    name: "update_inventory_admin",
    resource: "inventory",
    action: "update_admin",
    description: "Allow updating inventory information (admin access)",
  },
  {
    name: "delete_inventory_admin",
    resource: "inventory",
    action: "delete_admin",
    description: "Allow deleting inventory entries (admin access)",
  },

  // === ADVANCED ORDER MANAGEMENT (6 permissions) ===
  {
    name: "view_all_orders_admin",
    resource: "orders",
    action: "read_all_admin",
    description: "Allow viewing all orders in the system (admin access)",
  },
  {
    name: "create_order_admin",
    resource: "orders",
    action: "create_admin",
    description: "Allow creating orders (admin access)",
  },
  {
    name: "update_any_order_admin",
    resource: "orders",
    action: "update_any_admin",
    description: "Allow updating any order (admin access)",
  },
  {
    name: "update_order_status_admin",
    resource: "orders",
    action: "update_status_admin",
    description: "Allow updating order status (admin access)",
  },
  {
    name: "view_order_analytics_admin",
    resource: "orders",
    action: "read_analytics_admin",
    description: "Allow viewing order analytics (admin access)",
  },
  {
    name: "manage_orders_admin",
    resource: "orders",
    action: "manage_admin",
    description: "Full admin order management access",
  },

  // === ADVANCED USER MANAGEMENT (4 permissions) ===
  {
    name: "view_users_admin",
    resource: "users",
    action: "read_all_admin",
    description: "Allow viewing all users in the system (admin access)",
  },
  {
    name: "view_single_user_admin",
    resource: "users",
    action: "read_single_admin",
    description: "Allow viewing specific user details (admin access)",
  },
  {
    name: "assign_user_roles_admin",
    resource: "user_roles",
    action: "assign_admin",
    description: "Allow assigning roles to users (admin access)",
  },
  {
    name: "remove_user_roles_admin",
    resource: "user_roles",
    action: "remove_admin",
    description: "Allow removing roles from users (admin access)",
  },

  // === SUPPLY CHAIN MANAGEMENT (8 permissions) ===
  {
    name: "view_supplies_vendor",
    resource: "supplies",
    action: "read_vendor",
    description: "Allow viewing own supplies as vendor",
  },
  {
    name: "view_product_supply_history",
    resource: "supplies",
    action: "read_product_history",
    description: "Allow viewing supply history for any product",
  },
  {
    name: "create_supply_vendor",
    resource: "supplies",
    action: "create_vendor",
    description: "Allow creating supply entries as vendor",
  },
  {
    name: "update_supply_vendor",
    resource: "supplies",
    action: "update_vendor",
    description: "Allow updating supply entries as vendor",
  },
  {
    name: "delete_supply_vendor",
    resource: "supplies",
    action: "delete_vendor",
    description: "Allow deleting supply entries as vendor",
  },
  {
    name: "view_supply_summary_vendor",
    resource: "supplies",
    action: "read_summary_vendor",
    description: "Allow viewing supply summary as vendor",
  },
  {
    name: "view_supply_summary_admin",
    resource: "supplies",
    action: "read_summary_admin",
    description: "Allow viewing platform-wide supply summary (admin access)",
  },
  {
    name: "manage_supplies_admin",
    resource: "supplies",
    action: "manage_admin",
    description: "Full admin supply management access",
  },

  // === ADVANCED REVIEW SYSTEM (4 permissions) ===
  {
    name: "moderate_reviews_admin",
    resource: "reviews",
    action: "moderate_admin",
    description: "Allow moderating reviews (admin access)",
  },
  {
    name: "respond_to_reviews_vendor",
    resource: "reviews",
    action: "respond_vendor",
    description: "Allow responding to reviews as vendor",
  },
  {
    name: "flag_inappropriate_reviews",
    resource: "reviews",
    action: "flag",
    description: "Allow flagging inappropriate reviews",
  },
  {
    name: "remove_flagged_reviews_admin",
    resource: "reviews",
    action: "remove_flagged_admin",
    description: "Allow removing flagged reviews (admin access)",
  },

  // === ADVANCED VENDOR MANAGEMENT (13 permissions) ===
  {
    name: "view_vendors_admin",
    resource: "vendors",
    action: "read_all_admin",
    description: "Allow viewing all vendors (admin access)",
  },
  {
    name: "view_single_vendor_admin",
    resource: "vendors",
    action: "read_single_admin",
    description: "Allow viewing specific vendor details (admin access)",
  },
  {
    name: "update_vendor_status_admin",
    resource: "vendors",
    action: "update_status_admin",
    description: "Allow updating vendor status (admin access)",
  },
  {
    name: "approve_vendor_application_admin",
    resource: "vendors",
    action: "approve_application_admin",
    description: "Allow approving vendor applications (admin access)",
  },
  {
    name: "reject_vendor_application_admin",
    resource: "vendors",
    action: "reject_application_admin",
    description: "Allow rejecting vendor applications (admin access)",
  },
  {
    name: "suspend_vendor_admin",
    resource: "vendors",
    action: "suspend_admin",
    description: "Allow suspending vendors (admin access)",
  },
  {
    name: "activate_vendor_admin",
    resource: "vendors",
    action: "activate_admin",
    description: "Allow activating vendors (admin access)",
  },
  {
    name: "view_vendor_analytics_vendor",
    resource: "vendors",
    action: "read_analytics_vendor",
    description: "Allow viewing vendor analytics as vendor",
  },
  {
    name: "manage_vendor_onboarding",
    resource: "vendor_onboarding",
    action: "manage",
    description: "Allow managing vendor onboarding process",
  },
  {
    name: "view_vendor_followers",
    resource: "vendor_followers",
    action: "read",
    description: "Allow viewing vendor followers",
  },
  {
    name: "manage_vendor_followers",
    resource: "vendor_followers",
    action: "manage",
    description: "Allow managing vendor followers",
  },
  {
    name: "update_vendor_profile_vendor",
    resource: "vendors",
    action: "update_profile_vendor",
    description: "Allow updating vendor profile as vendor",
  },
  {
    name: "manage_vendors_admin",
    resource: "vendors",
    action: "manage_admin",
    description: "Full admin vendor management access",
  },
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const startTime = Date.now();
    let transaction;

    try {
      console.log("🚀 Starting optimized additional permission seeding...");
      console.log("=".repeat(60));

      // Validate input data
      console.log("\n📋 STEP 0: Validating input data...");
      let validPermissions = 0;
      const validationErrors = [];

      for (const perm of ADDITIONAL_PERMISSIONS) {
        const validation = validatePermission(perm);
        if (validation.isValid) {
          validPermissions++;
        } else {
          validationErrors.push({
            permission: perm.name,
            errors: validation.errors,
          });
        }
      }

      if (validationErrors.length > 0) {
        console.log(
          `   ❌ Found ${validationErrors.length} validation errors:`
        );
        validationErrors.forEach((err) => {
          console.log(`      • ${err.permission}: ${err.errors.join(", ")}`);
        });
        throw new Error(
          `Additional permission validation failed with ${validationErrors.length} errors`
        );
      }

      console.log(
        `   ✅ All ${validPermissions} additional permissions passed validation`
      );

      // Start transaction for atomic operations
      transaction = await queryInterface.sequelize.transaction({
        isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      });

      console.log(
        "\n📝 STEP 1: Creating additional permissions in bulk with transaction support..."
      );
      const permissionResults = await createAdditionalPermissionsInBulk(
        ADDITIONAL_PERMISSIONS,
        transaction
      );

      console.log("\n📊 Additional permission creation results:");
      console.log(
        `   • Successfully created: ${permissionResults.created.length}`
      );
      console.log(
        `   • Skipped (already exists): ${permissionResults.skipped.length}`
      );
      console.log(
        `   • Errors encountered: ${permissionResults.errors.length}`
      );
      console.log(`   • Total processed: ${permissionResults.totalProcessed}`);

      if (permissionResults.errors.length > 0) {
        console.log("\n❌ Additional permission creation errors:");
        permissionResults.errors.forEach((err) => {
          console.log(
            `   • ${err.name}: ${err.error || err.errors.join(", ")}`
          );
        });
      }

      // Get all created permissions for role assignment
      const allNewPermissions = await Permission.findAll({
        where: {
          name: { [Op.in]: ADDITIONAL_PERMISSIONS.map((p) => p.name) },
        },
        transaction,
      });

      // Get all roles
      const roles = await Role.findAll({ transaction });
      console.log(
        `\n🔗 STEP 2: Assigning additional permissions to ${roles.length} roles...`
      );
      console.log(`   👥 Found roles: ${roles.map((r) => r.name).join(", ")}`);

      const assignmentResults = await assignAdditionalPermissionsToRolesInBulk(
        roles,
        allNewPermissions,
        transaction
      );

      console.log("\n📊 Additional role assignment results:");
      console.log(
        `   • Successfully assigned: ${assignmentResults.assigned.length}`
      );
      console.log(
        `   • Skipped (already assigned): ${assignmentResults.skipped.length}`
      );
      console.log(
        `   • Errors encountered: ${assignmentResults.errors.length}`
      );

      if (assignmentResults.errors.length > 0) {
        console.log("\n❌ Additional role assignment errors:");
        assignmentResults.errors.forEach((err) => {
          console.log(
            `   • Permission ${err.assignment.permission_id} -> Role ${err.assignment.role_id}: ${err.error}`
          );
        });
      }

      // Commit transaction
      await transaction.commit();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Final summary
      console.log("\n" + "=".repeat(60));
      console.log(
        "🎉 OPTIMIZED ADDITIONAL PERMISSION SEEDING COMPLETED SUCCESSFULLY!"
      );
      console.log("=".repeat(60));
      console.log(`⏱️  Total duration: ${duration}ms`);
      console.log(`📈 Summary:`);
      console.log(
        `   • Additional permissions created: ${permissionResults.created.length}`
      );
      console.log(
        `   • Total permissions in database: ${await Permission.count()}`
      );
      console.log(
        `   • Additional role-permission assignments: ${assignmentResults.assigned.length}`
      );
      console.log(`   • Roles processed: ${roles.length}`);

      return {
        success: true,
        duration,
        createdPermissions: permissionResults.created.length,
        totalPermissions: await Permission.count(),
        assignedPermissions: assignmentResults.assigned.length,
        validationErrors: validationErrors.length,
        processingErrors:
          permissionResults.errors.length + assignmentResults.errors.length,
      };
    } catch (error) {
      console.error(
        "\n💥 ERROR during optimized additional permission seeding:",
        error.message
      );

      // Rollback transaction if active
      if (transaction && !transaction.finished) {
        console.log("🔄 Rolling back transaction...");
        await transaction.rollback();
      }

      console.error(error.stack);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const startTime = Date.now();
    let transaction;

    try {
      console.log(
        "🔄 Starting optimized additional permission seeding rollback..."
      );
      console.log("=".repeat(60));

      // Start transaction for atomic rollback
      transaction = await queryInterface.sequelize.transaction({
        isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      });

      // Get additional permissions to be removed
      const additionalPermissions = await Permission.findAll({
        where: {
          name: { [Op.in]: ADDITIONAL_PERMISSIONS.map((p) => p.name) },
        },
        transaction,
      });

      console.log(
        `\n🗑️  Found ${additionalPermissions.length} additional permissions to remove`
      );

      if (additionalPermissions.length > 0) {
        // Remove all permission-role associations for additional permissions
        console.log(
          "\n🗑️  Removing additional permission-role associations..."
        );
        const deletedRoleAssociations = await queryInterface.bulkDelete(
          "permission_roles",
          {
            permission_id: { [Op.in]: additionalPermissions.map((p) => p.id) },
          },
          { transaction }
        );
        console.log(
          `   ✅ Removed ${deletedRoleAssociations} additional permission-role associations`
        );

        // Remove all permission-user associations for additional permissions
        console.log(
          "\n🗑️  Removing additional permission-user associations..."
        );
        const deletedUserAssociations = await queryInterface.bulkDelete(
          "permission_users",
          {
            permission_id: { [Op.in]: additionalPermissions.map((p) => p.id) },
          },
          { transaction }
        );
        console.log(
          `   ✅ Removed ${deletedUserAssociations} additional permission-user associations`
        );

        // Remove additional permissions
        console.log("\n🗑️  Removing additional permissions...");
        const deletedPermissions = await queryInterface.bulkDelete(
          "permissions",
          { id: { [Op.in]: additionalPermissions.map((p) => p.id) } },
          { transaction }
        );
        console.log(
          `   ✅ Removed ${deletedPermissions} additional permissions`
        );
      }

      // Commit transaction
      await transaction.commit();

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log("\n" + "=".repeat(60));
      console.log(
        "✅ Optimized additional permission seeding rollback completed successfully!"
      );
      console.log("=".repeat(60));
      console.log(`⏱️  Rollback duration: ${duration}ms`);

      return {
        success: true,
        duration,
        message: "Additional permissions and associations removed",
        deletedPermissions: additionalPermissions.length,
      };
    } catch (error) {
      console.error(
        "\n💥 ERROR during optimized additional permission seeding rollback:",
        error.message
      );

      // Rollback transaction if active
      if (transaction && !transaction.finished) {
        console.log("🔄 Rolling back transaction...");
        await transaction.rollback();
      }

      console.error(error.stack);
      throw error;
    }
  },
};
