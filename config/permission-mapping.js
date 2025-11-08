const { permissionMap, publicRoutes } = require("./permission");

/**
 * Route mapping rules - defines how to convert actual paths to permission map keys
 * This ensures consistency between what's in the URL and what's in your permission map
 */
const ROUTE_PATTERNS = [
  // Specific patterns first (most specific to least specific)
  { pattern: /^\/products\/recent\/stats$/, template: '/products/recent/stats' },
  { pattern: /^\/products\/recent\/anonymize$/, template: '/products/recent/anonymize' },
  { pattern: /^\/products\/recent$/, template: '/products/recent' },
  { pattern: /^\/inventory\/product\/[\w-]+$/, template: '/inventory/product/:productId' },
  { pattern: /^\/categories\/([\w-]+)$/, template: '/categories/:identifier' },
  { pattern: /^\/categories\/([\w-]+)\/products$/, template: '/categories/:identifier/products' },
  { pattern: /^\/products\/([\w-]+)\/reviews$/, template: '/products/:id/reviews' },
  { pattern: /^\/products\/([\w-]+)\/analytics$/, template: '/products/:id/analytics' },
  { pattern: /^\/vendors\/([\w-]+)\/products$/, template: '/vendors/:id/products' },
  { pattern: /^\/vendors\/([\w-]+)\/follow$/, template: '/vendors/:vendorId/follow' },
  { pattern: /^\/vendors\/vendor\/([\w-]+)\/followers$/, template: '/vendors/vendor/:vendorId/followers' },
  { pattern: /^\/vendors\/vendor\/([\w-]+)\/follow-status$/, template: '/vendors/vendor/:vendorId/follow-status' },
  { pattern: /^\/vendors\/user\/([\w-]+)\/following$/, template: '/vendors/user/:userId/following' },
  { pattern: /^\/collections\/([\w-]+)\/products$/, template: '/collections/:id/products' },
  { pattern: /^\/cart\/items\/([\w-]+)$/, template: '/cart/items/:itemId' },
  { pattern: /^\/wishlists\/([\w-]+)\/items\/([\w-]+)$/, template: '/wishlists/:id/items/:itemId' },
  { pattern: /^\/wishlists\/([\w-]+)\/items$/, template: '/wishlists/:id/items' },
  { pattern: /^\/wishlists\/([\w-]+)\/summary$/, template: '/wishlists/:id/summary' },
  { pattern: /^\/wishlists\/([\w-]+)\/move-to-cart$/, template: '/wishlists/:id/move-to-cart' },
  { pattern: /^\/wishlists\/([\w-]+)$/, template: '/wishlists/:id' },
  { pattern: /^\/orders\/verify-payment\/([\w-]+)$/, template: '/orders/verify-payment/:reference' },
  { pattern: /^\/orders\/items\/([\w-]+)\/status$/, template: '/orders/items/:id/status' },
  { pattern: /^\/auth\/verify-phone-change\/([\w-]+)$/, template: '/auth/verify-phone-change/:token' },
  { pattern: /^\/auth\/approve-phone-change\/([\w-]+)$/, template: '/auth/approve-phone-change/:userId' },
  { pattern: /^\/auth\/reject-phone-change\/([\w-]+)$/, template: '/auth/reject-phone-change/:userId' },
  { pattern: /^\/inventory\/history\/([\w-]+)$/, template: '/inventory/history/:productId' },
  { pattern: /^\/inventory\/product\/([\w-]+)$/, template: '/inventory/product/:productId' },
  { pattern: /^\/supply\/vendor\/([\w-]+)$/, template: '/supply/vendor/:vendorId' },
  { pattern: /^\/dashboard\/product\/([\w-]+)$/, template: '/dashboard/product/:id' },
  { pattern: /^\/admin\/products\/([\w-]+)\/approve$/, template: '/admin/products/:id/approve' },
  { pattern: /^\/admin\/products\/([\w-]+)\/reject$/, template: '/admin/products/:id/reject' },
  { pattern: /^\/admin\/products\/([\w-]+)\/status$/, template: '/admin/products/:id/status' },
  { pattern: /^\/admin\/products\/([\w-]+)\/analytics$/, template: '/admin/products/:id/analytics' },
  { pattern: /^\/admin\/products\/status\/([\w-]+)$/, template: '/admin/products/status/:status' },
  { pattern: /^\/admin\/inventory\/product\/([\w-]+)$/, template: '/admin/inventory/product/:productId' },
  { pattern: /^\/admin\/inventory\/history\/([\w-]+)$/, template: '/admin/inventory/history/:productId' },
  { pattern: /^\/admin\/inventory\/vendor\/([\w-]+)$/, template: '/admin/inventory/vendor/:vendorId' },
  { pattern: /^\/admin\/supply\/vendor\/([\w-]+)$/, template: '/admin/supply/vendor/:vendorId' },
  { pattern: /^\/admin\/supply\/product\/([\w-]+)$/, template: '/admin/supply/product/:productId' },
  { pattern: /^\/admin\/orders\/([\w-]+)\/status$/, template: '/admin/orders/:id/status' },
  { pattern: /^\/admin\/collections\/([\w-]+)\/products$/, template: '/admin/collections/:id/products' },
  { pattern: /^\/admin\/dashboard\/vendor-overview\/([\w-]+)$/, template: '/admin/dashboard/vendor-overview/:vendorId' },
  { pattern: /^\/admin\/subadmins\/([\w-]+)\/permissions$/, template: '/admin/subadmins/:id/permissions' },
  { pattern: /^\/vendors\/([\w-]+)\/approve$/, template: '/vendors/:id/approve' },
  { pattern: /^\/vendors\/([\w-]+)\/reject$/, template: '/vendors/:id/reject' },
  
  // Generic patterns (catch-all for remaining routes)
  { pattern: /^\/users\/([\w-]+)\/roles$/, template: '/users/:id/roles' },
  { pattern: /^\/products\/vendor\/([\w-]+)$/, template: '/products/vendor/:id' },
  { pattern: /^\/products\/([\w-]+)$/, template: '/products/:identifier' },
  { pattern: /^\/vendors\/([\w-]+)$/, template: '/vendors/:id' },
  { pattern: /^\/categories\/([\w-]+)$/, template: '/categories/:id' },
  { pattern: /^\/collections\/([\w-]+)$/, template: '/collections/:id' },
  { pattern: /^\/orders\/([\w-]+)\/cancel$/, template: '/orders/:id/cancel' },
  { pattern: /^\/orders\/([\w-]+)$/, template: '/orders/:id' },
  { pattern: /^\/addresses\/([\w-]+)$/, template: '/addresses/:id' },
  { pattern: /^\/inventory\/([\w-]+)$/, template: '/inventory/:id' },
  { pattern: /^\/supply\/([\w-]+)$/, template: '/supply/:id' },
  { pattern: /^\/reviews\/([\w-]+)$/, template: '/reviews/:id' },
  { pattern: /^\/journals\/([\w-]+)$/, template: '/journals/:id' },
  { pattern: /^\/variants\/([\w-]+)$/, template: '/variants/:id' },
  { pattern: /^\/webhooks\/([\w-]+)$/, template: '/webhooks/:id' },
  { pattern: /^\/users\/([\w-]+)$/, template: '/users/:id' },
  { pattern: /^\/roles\/([\w-]+)$/, template: '/roles/:id' },
  { pattern: /^\/admin\/categories\/([\w-]+)$/, template: '/admin/categories/:id' },
  { pattern: /^\/admin\/collections\/([\w-]+)$/, template: '/admin/collections/:id' },
  { pattern: /^\/admin\/products\/([\w-]+)$/, template: '/admin/products/:id' },
  { pattern: /^\/admin\/inventory\/([\w-]+)$/, template: '/admin/inventory/:id' },
  { pattern: /^\/admin\/journal\/([\w-]+)$/, template: '/admin/journal/:id' },
  { pattern: /^\/admin\/orders\/([\w-]+)$/, template: '/admin/orders/:id' },
  { pattern: /^\/admin\/supplies\/([\w-]+)$/, template: '/admin/supplies/:id' },
  { pattern: /^\/admin\/webhooks\/([\w-]+)$/, template: '/admin/webhooks/:id' },
  { pattern: /^\/admin\/subadmins\/([\w-]+)$/, template: '/admin/subadmins/:id' },
];

/**
 * Generate route key from method and path using pattern matching
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {string} Route key
 */
function generateRouteKey(method, path) {
  // Remove /api/v1 prefix if present
  let normalizedPath = path.replace(/^\/api\/v1/, "");
  
  // Remove query parameters and trailing slashes
  normalizedPath = normalizedPath.split("?")[0].replace(/\/$/, "");

  // Try to match against known patterns
  for (const { pattern, template } of ROUTE_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return `${method.toUpperCase()} ${template}`;
    }
  }

  // If no pattern matched, return as-is (for static routes)
  return `${method.toUpperCase()} ${normalizedPath}`;
}

/**
 * Check if a route is public (doesn't require authentication)
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {boolean} True if route is public
 */
function isPublicRoute(method, path) {
  const routeKey = generateRouteKey(method, path);
  
  if (process.env.NODE_ENV === 'development') {
    console.log("[Public Route Check]");
    console.log("  Original Path:", path);
    console.log("  Generated Route Key:", routeKey);
    console.log("  Is Public:", publicRoutes.includes(routeKey));
  }
  
  return publicRoutes.includes(routeKey);
}

/**
 * Get required permission for a route
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {string|null} Required permission or null if public/no permission
 */
function getRequiredPermission(method, path) {
  const routeKey = generateRouteKey(method, path);
  
  if (process.env.NODE_ENV === 'development') {
    console.log("[Permission Check]");
    console.log("  Original Path:", path);
    console.log("  Generated Route Key:", routeKey);
    console.log("  Required Permission:", permissionMap[routeKey] || "none");
  }
  
  return permissionMap[routeKey] || null;
}

/**
 * Get all routes with their required permissions
 * @returns {Object} Object with route keys as keys and permissions as values
 */
function getAllRoutes() {
  return { ...permissionMap };
}

/**
 * Get public routes
 * @returns {Array} Array of public route keys
 */
function getPublicRoutes() {
  return [...publicRoutes];
}

/**
 * Get routes by permission
 * @param {string} permission - Permission name
 * @returns {Array} Array of route keys that require this permission
 */
function getRoutesByPermission(permission) {
  return Object.entries(permissionMap)
    .filter(([, perm]) => perm === permission)
    .map(([route]) => route);
}

/**
 * Get routes by resource
 * @param {string} resource - Resource name
 * @returns {Array} Array of route keys for the resource
 */
function getRoutesByResource(resource) {
  return Object.entries(permissionMap)
    .filter(([route]) => route.includes(`/${resource}`))
    .map(([route]) => route);
}

module.exports = {
  permissionMap,
  publicRoutes,
  generateRouteKey,
  isPublicRoute,
  getRequiredPermission,
  getAllRoutes,
  getPublicRoutes,
  getRoutesByPermission,
  getRoutesByResource,
};