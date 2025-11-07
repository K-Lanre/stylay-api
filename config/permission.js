// Permission Map: 'METHOD /path' -> 'permission name'
// This file now serves as a legacy interface - actual mapping is in permission-mapping.js
// Permission Map: 'METHOD /path' -> 'permission name'
export const permissionMap = {
  // Auth Routes
  'POST /auth/register': null, // Public
  'POST /auth/register-admin': null, // Public
  'POST /auth/login': null, // Public
  'POST /auth/verify-email': null, // Public
  'POST /auth/resend-verification': null, // Public
  'POST /auth/forgot-password': null, // Public
  'POST /auth/reset-password': null, // Public
  'GET /auth/verify-phone-change/:token': null, // Public
  'GET /auth/me': 'users_read',
  'PUT /auth/me': 'users_update',
  'PATCH /auth/update-password': 'users_update',
  'POST /auth/request-phone-change': 'users_update',
  'POST /auth/cancel-phone-change': 'users_update',
  'GET /auth/logout': null,
  'GET /auth/pending-phone-changes': 'users_manage',
  'PATCH /auth/approve-phone-change/:userId': 'users_manage',
  'PATCH /auth/reject-phone-change/:userId': 'users_manage',

  // Vendor Routes
  'POST /vendors/register': null, // Public
  'GET /vendors': null, // Public
  'GET /vendors/:id/products': null, // Public
  'GET /vendors/:id': null, // Public
  'GET /vendors/vendor/profile': 'vendors_read',
  'PATCH /vendors/complete-onboarding': 'vendors_update',
  'POST /vendors/:vendorId/follow': 'vendors_follow',
  'DELETE /vendors/:vendorId/follow': 'vendors_follow',
  'GET /vendors/vendor/:vendorId/followers': 'vendors_read',
  'GET /vendors/vendor/:vendorId/follow-status': 'vendors_read',
  'GET /vendors/user/:userId/following': 'vendors_read',
  'GET /vendors/user/following': 'vendors_read',
  'GET /vendors/profile/followers': 'vendors_read',
  'PATCH /vendors/:id/approve': 'vendors_approve',
  'PATCH /vendors/:id/reject': 'vendors_reject',

  // Product Routes
  'GET /products/:id': null, // Public
  'GET /products': 'products_read',
  'GET /products/vendor/:id': 'products_read',
  'GET /products/:id/analytics': 'products_analytics',
  'GET /products/analytics/vendor': 'products_analytics',
  'POST /products': 'products_create',
  'PUT /products/:id': 'products_update',
  'DELETE /products/:id': 'products_delete',

  // Category Routes
  'GET /categories': 'categories_read',
  'GET /categories/tree': 'categories_read',
  'GET /categories/:identifier': 'categories_read',
  'GET /categories/:id/products': 'categories_read',

  // Collection Routes
  'GET /collections': 'collections_read',
  'GET /collections/:id': 'collections_read',
  'GET /collections/:id/products': 'collections_read',

  // Dashboard Routes
  'GET /dashboard/new-arrivals': null, // Public
  'GET /dashboard/trending-now': null, // Public
  'GET /dashboard/latest-journal': null, // Public
  'GET /dashboard/product/:id': 'products_read',
  'GET /dashboard/vendor/metrics': 'analytics_dashboard',
  'GET /dashboard/vendor/products': 'products_read',
  'GET /dashboard/vendor/earnings': 'earnings_read',
  'GET /dashboard/vendor/earnings-breakdown': 'earnings_read',

  // Cart Routes
  'GET /cart': 'cart_read',
  'POST /cart/items': 'cart_create',
  'PUT or/:itemId': 'cart_update',
  'DELETE /cart/items/:itemId': 'cart_delete',
  'DELETE /cart/clear': 'cart_delete',
  'POST /cart/sync': 'cart_create',
  'GET /cart/summary': 'cart_read',

  // Wishlist Routes
  'GET /wishlist': 'wishlist_read',
  'POST /wishlist': 'wishlist_create',
  'GET /wishlist/:id': 'wishlist_read',
  'PUT /wishlist/:id': 'wishlist_update',
  'DELETE /wishlist/:id': 'wishlist_delete',
  'GET /wishlist/:id/items': 'wishlist_read',
  'POST /wishlist/:id/items': 'wishlist_create',
  'PUT /wishlist/:id/items/:itemId': 'wishlist_update',
  'DELETE /wishlist/:id/items/:itemId': 'wishlist_delete',

  // User Routes (Admin only)
  'GET /users': 'users_read',
  'POST /users': 'users_create',
  'GET /users/:id': 'users_read',
  'PATCH /users/:id': 'users_update',
  'DELETE /users/:id': 'users_delete',
  'POST /users/:id/roles': 'users_manage',
  'DELETE /users/:id/roles': 'users_manage',

  // Role Routes (Admin only)
  'GET /roles': 'roles_read',
  'POST /roles': 'roles_create',
  'GET /roles/:id': 'roles_read',
  'PATCH /roles/:id': 'roles_update',
  'DELETE /roles/:id': 'roles_delete',

  // Order Routes
  'POST /orders': 'orders_create',
  'GET /orders/my-orders': 'orders_read',
  'GET /orders/:id': 'orders_read',
  'PATCH /orders/:id/cancel': 'orders_cancel',
  'GET /orders/verify-payment/:reference': null, // Public
  'POST /orders/webhook/payment': null, // Public
  'GET /orders/vendor/orders': 'orders_read',
  'PATCH /orders/items/:id/status': 'orders_update',

  // Address Routes
  'GET /addresses': 'addresses_read',
  'POST /addresses': 'addresses_create',
  'GET /addresses/:id': 'addresses_read',
  'PUT /addresses/:id': 'addresses_update',
  'DELETE /addresses/:id': 'addresses_delete',

  // Inventory Routes
  'GET /inventory': 'inventory_read',
  'GET /inventory/:id': 'inventory_read',
  'PUT /inventory/:id': 'inventory_update',
  'GET /inventory/product/:productId': 'inventory_read',
  'GET /inventory/history/:productId': 'inventory_read',

  // Supply Routes
  'GET /supply': 'supply_read',
  'POST /supply': 'supply_create',
  'GET /supply/:id': 'supply_read',
  'PUT /supply/:id': 'supply_update',
  'DELETE /supply/:id': 'supply_delete',
  'GET /supply/vendor/:vendorId': 'supply_read',

  // Review Routes
  'GET /reviews': 'reviews_read',
  'POST /reviews': 'reviews_create',
  'GET /reviews/:id': 'reviews_read',
  'PUT /reviews/:id': 'reviews_update',
  'DELETE /reviews/:id': 'reviews_delete',

  // Journal Routes
  'GET /journal': 'journals_read',
  'POST /journal': 'journals_create',
  'GET /journal/:id': 'journals_read',
  'PUT /journal/:id': 'journals_update',
  'DELETE /journal/:id': 'journals_delete',

  // Variant Routes
  'GET /variants': 'variants_read',
  'POST /variants': 'variants_create',
  'GET /variants/:id': 'variants_read',
  'PUT /variants/:id': 'variants_update',
  'DELETE /variants/:id': 'variants_delete',

  // Webhook Routes
  'POST /webhooks/payment': null, // Public
  'GET /webhooks': 'webhooks_read',
  'POST /webhooks': 'webhooks_create',
  'GET /webhooks/:id': 'webhooks_read',
  'PUT /webhooks/:id': 'webhooks_update',
  'DELETE /webhooks/:id': 'webhooks_delete',

  // Admin Sub-Routes
  'GET /admin/categories': 'categories_read',
  'POST /admin/categories': 'categories_create',
  'GET /admin/categories/:id': 'categories_read',
  'PUT /admin/categories/:id': 'categories_update',
  'DELETE /admin/categories/:id': 'categories_delete',

  'GET /admin/collections': 'collections_read',
  'POST /admin/collections': 'collections_create',
  'GET /admin/collections/:id': 'collections_read',
  'PUT /admin/collections/:id': 'collections_update',
  'DELETE /admin/collections/:id': 'collections_delete',

  'GET /admin/dashboard': 'analytics_dashboard',
  'GET /admin/dashboard/summary': 'analytics_dashboard',
  'GET /admin/dashboard/users': 'analytics_dashboard',
  'GET /admin/dashboard/vendors': 'analytics_dashboard',
  'GET /admin/dashboard/products': 'analytics_dashboard',
  'GET /admin/dashboard/orders': 'analytics_dashboard',

  'GET /admin/products': 'products_read',
  'POST /admin/products': 'products_create',
  'GET /admin/products/:id': 'products_read',
  'PUT /admin/products/:id': 'products_update',
  'DELETE /admin/products/:id': 'products_delete',
  'PATCH /admin/products/:id/approve': 'products_update',
  'PATCH /admin/products/:id/reject': 'products_update',

  'GET /admin/inventory': 'inventory_read',
  'GET /admin/inventory/:id': 'inventory_read',
  'PUT /admin/inventory/:id': 'inventory_update',
  'GET /admin/inventory/product/:productId': 'inventory_read',
  'GET /admin/inventory/history/:productId': 'inventory_read',

  'GET /admin/journal': 'journals_read',
  'POST /admin/journal': 'journals_create',
  'GET /admin/journal/:id': 'journals_read',
  'PUT /admin/journal/:id': 'journals_update',
  'DELETE /admin/journal/:id': 'journals_delete',

  'GET /admin/orders': 'orders_read',
  'GET /admin/orders/:id': 'orders_read',
  'PUT /admin/orders/:id': 'orders_update',
  'PATCH /admin/orders/:id/status': 'orders_update',
  'DELETE /admin/orders/:id': 'orders_delete',

  'GET /admin/supplies': 'supply_read',
  'POST /admin/supplies': 'supply_create',
  'GET /admin/supplies/:id': 'supply_read',
  'PUT /admin/supplies/:id': 'supply_update',
  'DELETE /admin/supplies/:id': 'supply_delete',

  'GET /admin/webhooks': 'webhooks_read',
  'POST /admin/webhooks': 'webhooks_create',
  'GET /admin/webhooks/:id': 'webhooks_read',
  'PUT /admin/webhooks/:id': 'webhooks_update',
  'DELETE /admin/webhooks/:id': 'webhooks_delete',

  'GET /admin/subadmins': 'users_read',
  'POST /admin/subadmins': 'users_create',
  'GET /admin/subadmins/:id': 'users_read',
  'PUT /admin/subadmins/:id': 'users_update',
  'DELETE /admin/subadmins/:id': 'users_delete',

  // Dashboard Admin Routes
  'GET /admin/dashboard/metrics': 'analytics_dashboard',
  'GET /admin/dashboard/recent-orders': 'analytics_dashboard',
  'GET /admin/dashboard/top-selling-vendors': 'analytics_dashboard',
  'GET /admin/dashboard/top-selling-items': 'analytics_dashboard',
  'GET /admin/dashboard/sales-stats': 'analytics_dashboard',
  'GET /admin/dashboard/top-categories': 'analytics_dashboard',
  'GET /admin/dashboard/vendor-onboarding-stats': 'analytics_dashboard',
  'GET /admin/dashboard/vendor-overview/:vendorId': 'analytics_dashboard',
  'GET /admin/dashboard/products': 'products_read',

  // Subadmin Admin Routes
  'GET /admin/subadmins/permissions/all': 'users_read',
  'GET /admin/subadmins/roles/all': 'users_read',
  'GET /admin/subadmins/permission-groups/all': 'users_read',
  'PATCH /admin/subadmins/:id/permissions': 'users_update',

  // Product Admin Routes (Additional)
  'GET /admin/products/all': 'products_read',
  'PATCH /admin/products/:id/status': 'products_update',
  'GET /admin/products/status/:status': 'products_read',
  'GET /admin/products/:id/analytics': 'products_analytics',

  // Supply Admin Routes
  'GET /admin/supply/all': 'supply_read',
  'GET /admin/supply/vendor/:vendorId': 'supply_read',
  'GET /admin/supply/product/:productId': 'supply_read',
  'GET /admin/supply/summary': 'supply_read',

  // Webhook Admin Routes
  'GET /admin/webhooks/all': 'webhooks_read',
  'POST /admin/webhooks/test': 'webhooks_create',

  // Inventory Admin Routes
  'GET /admin/inventory/all': 'inventory_read',
  'GET /admin/inventory/vendor/:vendorId': 'inventory_read',
  'GET /admin/inventory/low-stock': 'inventory_read',
  'GET /admin/inventory/history': 'inventory_read',

  // Collection Admin Routes (Additional)
  'POST /admin/collections/:id/products': 'collections_update',
  'DELETE /admin/collections/:id/products': 'collections_update',
};

// Public Routes: Array of 'METHOD /path' that don't require authentication
export const publicRoutes = [
  // Auth routes
  'POST /auth/register',
  'POST /auth/register-admin',
  'POST /auth/login',
  'POST /auth/verify-email',
  'POST /auth/resend-verification',
  'POST /auth/forgot-password',
  'POST /auth/reset-password',
  'GET /auth/verify-phone-change/:token',

  // Vendor routes
  'POST /vendors/register',
  'GET /vendors',
  'GET /vendors/:id/products',
  'GET /vendors/:id',

  // Product routes
  'GET /products/:id/reviews',
  'GET /products/:id',
  'GET /products',

  // Category routes
  'GET /categories',
  'GET /categories/tree',
  'GET /categories/:identifier',
  'GET /categories/:id/products',

  // Collection routes
  'GET /collections',
  'GET /collections/:id',
  'GET /collections/:id/products',

  // Dashboard routes
  'GET /dashboard/new-arrivals',
  'GET /dashboard/trending-now',
  'GET /dashboard/latest-journal',
  'GET /dashboard/product/:id',

  // Order routes
  'POST /orders/webhook/payment',
  'GET /orders/verify-payment/:reference',

  // Webhook routes
  'POST /webhooks/payment',
];


