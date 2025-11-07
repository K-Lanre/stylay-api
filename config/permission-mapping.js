const { permissionMap, publicRoutes } = require('./permission');
/**
 * Generate route key from method and path
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {string} Route key
 */
function generateRouteKey(method, path) {
  // Normalize path by removing query parameters and trailing slashes
  const normalizedPath = path.split('?')[0].replace(/\/$/, '');
  
  // Convert dynamic segments to :param format
  const pathWithParams = normalizedPath.replace(/\/\d+/g, '/:id')
                                       .replace(/\/[a-f0-9-]{36}/g, '/:id'); // UUID pattern
  
  return `${method.toUpperCase()} ${pathWithParams}`;
}

/**
 * Check if a route is public (doesn't require authentication)
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {boolean} True if route is public
 */
function isPublicRoute(method, path) {
  path = path.replace('/api/v1', '');
  const routeKey = generateRouteKey(method, path);
  console.log('Route Key:', routeKey);
  return publicRoutes.includes(routeKey);
}

/**
 * Get required permission for a route
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {string|null} Required permission or null if public
 */
function getRequiredPermission(method, path) {
  const routeKey = generateRouteKey(method, path);
  console.log('Route Key:', routeKey);
  console.log("Permission:", permissionMap[routeKey]);
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
  getRoutesByResource
};
