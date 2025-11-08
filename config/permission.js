// Permission Map: 'METHOD /path' -> 'permission name'
// This file now serves as a legacy interface - actual mapping is in permission-mapping.js
// Permission Map: 'METHOD /path' -> 'permission name'
export const permissionMap = {
  // ========================================
  // AUTH ROUTES
  // ========================================
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

  // ========================================
  // ADDRESS ROUTES
  // ========================================
  'GET /addresses': 'addresses_read',
  'POST /addresses': 'addresses_create',
  'GET /addresses/:id': 'addresses_read',
  'PUT /addresses/:id': 'addresses_update',
  'PATCH /addresses/:id/default': 'addresses_update',
  'DELETE /addresses/:id': 'addresses_delete',

  // ========================================
  // CART ROUTES
  // ========================================
  'GET /cart': 'cart_read',
  'POST /cart/items': 'cart_create',
  'PUT /cart/items/:itemId': 'cart_update',
  'DELETE /cart/items/:itemId': 'cart_delete',
  'DELETE /cart/clear': 'cart_delete',
  'POST /cart/sync': 'cart_create',
  'GET /cart/summary': 'cart_read',

  // ========================================
  // CATEGORY ROUTES (Public)
  // ========================================
  'GET /categories': null, // Public
  'GET /categories/tree': null, // Public
  'GET /categories/:identifier': null, // Public
  'GET /categories/:identifier/products': null, // Public

  // ========================================
  // COLLECTION ROUTES (Public)
  // ========================================
  'GET /collections': null, // Public
  'GET /collections/:id': null, // Public
  'GET /collections/:id/products': null, // Public

  // ========================================
  // DASHBOARD ROUTES
  // ========================================
  'GET /dashboard/new-arrivals': null, // Public
  'GET /dashboard/trending-now': null, // Public
  'GET /dashboard/latest-journal': null, // Public
  'GET /dashboard/product/:id': null, // Public (changed from products_read)
  'GET /dashboard/vendor/metrics': 'analytics_dashboard',
  'GET /dashboard/vendor/products': 'products_read',
  'GET /dashboard/vendor/earnings': 'earnings_read',
  'GET /dashboard/vendor/earnings-breakdown': 'earnings_read',

  // ========================================
  // INVENTORY ROUTES (Vendor)
  // ========================================
  'GET /inventory/product/:productId': 'inventory_read',
  'PATCH /inventory/product/:productId': 'inventory_update',
  'GET /inventory/low-stock': 'inventory_read',
  'GET /inventory/history/:productId': 'inventory_read',

  // ========================================
  // JOURNAL ROUTES (Public)
  // ========================================
  'GET /journals': null, // Public 
  'GET /journals/:id': null, // Public

  // ========================================
  // ORDER ROUTES
  // ========================================
  'POST /orders': 'orders_create',
  'GET /orders/my-orders': 'orders_read',
  'GET /orders/:id': 'orders_read',
  'PATCH /orders/:id/cancel': 'orders_cancel',
  'GET /orders/verify-payment/:reference': null, // Public
  'POST /orders/webhook/payment': null, // Public (webhook)
  'GET /orders/vendor/orders': 'orders_read',
  'PATCH /orders/items/:id/status': 'orders_update',

  // ========================================
  // PRODUCT ROUTES
  // ========================================
  // Public routes
  'GET /products/:productId/reviews': null, // Publics
  'GET /products/:identifier': null, // Public
  'GET /products': null, // Public
  'GET /products/vendor/:id': null, // Public
  
  // Protected routes
  'GET /products/recent': 'recently_viewed_read',
  'GET /products/recent/stats': 'recently_viewed_read',
  'DELETE /products/recent': 'recently_viewed_delete',
  'PATCH /products/recent/anonymize': 'recently_viewed_update',
  'GET /products/:id/analytics': 'products_analytics',
  'GET /products/analytics/vendor': 'products_analytics',
  'POST /products': 'products_create',
  'PUT /products/:id': 'products_update',
  'DELETE /products/:id': 'products_delete',

  // ========================================
  // REVIEW ROUTES
  // ========================================
  'GET /reviews': null, // Public
  'GET /reviews/:id': null, // Public
  'POST /reviews': 'reviews_create',
  'PUT /reviews/:id': 'reviews_update',
  'DELETE /reviews/:id': 'reviews_delete',

  // ========================================
  // ROLE ROUTES (Admin only)
  // ========================================
  'GET /roles': 'roles_read',
  'POST /roles': 'roles_create',
  'GET /roles/:id': 'roles_read',
  'PATCH /roles/:id': 'roles_update',
  'DELETE /roles/:id': 'roles_delete',

  // ========================================
  // SUPPLY ROUTES (Vendor)
  // ========================================
  'POST /supply': 'supplies_create',
  'POST /supply/bulk': 'supplies_create',
  'GET /supply/vendor': 'supplies_read',

  // ========================================
  // USER ROUTES (Admin only)
  // ========================================
  'GET /users': 'users_read',
  'POST /users': 'users_create',
  'GET /users/:id': 'users_read',
  'PATCH /users/:id': 'users_update',
  'DELETE /users/:id': 'users_delete',
  'POST /users/:id/roles': 'users_manage',
  'DELETE /users/:id/roles': 'users_manage',

  // ========================================
  // VARIANT ROUTES
  // ========================================
  'GET /variants/types': 'variants_read',
  'POST /variants/types': 'variants_create',
  'PUT /variants/types/:id': 'variants_update',
  'DELETE /variants/types/:id': 'variants_delete',
  'GET /variants/products/:productId/combinations': 'variants_read',
  'GET /variants/combinations/:id': 'variants_read',
  'PATCH /variants/combinations/:id/stock': 'variants_update',
  'PATCH /variants/combinations/:id/price': 'variants_update',
  'PATCH /variants/combinations/:id/status': 'variants_update',

  // ========================================
  // VENDOR ROUTES
  // ========================================
  // Public routes
  'POST /vendors/register': null, // Public
  'GET /vendors': null, // Public
  'GET /vendors/:id/products': null, // Public
  'GET /vendors/:id': null, // Public
  
  // Protected routes
  'GET /vendors/vendor/profile': 'vendors_read',
  'GET /vendors/:id/profile': 'vendors_read',
  'PATCH /vendors/complete-onboarding': 'vendors_update',
  
  // Follow/Following routes
  'POST /vendors/:vendorId/follow': 'vendors_follow',
  'DELETE /vendors/:vendorId/follow': 'vendors_follow',
  'GET /vendors/vendor/:vendorId/followers': 'vendors_read',
  'GET /vendors/vendor/:vendorId/follow-status': 'vendors_read',
  'GET /vendors/user/:userId/following': 'vendors_read',
  'GET /vendors/user/following': 'vendors_read',
  'GET /vendors/profile/followers': 'vendors_read',
  
  // Admin routes
  'PATCH /vendors/:id/approve': 'vendors_approve',
  'PATCH /vendors/:id/reject': 'vendors_reject',

  // ========================================
  // WEBHOOK ROUTES
  // ========================================
  'POST /webhooks/paystack': null, // Public (webhook)

  // ========================================
  // WISHLIST ROUTES
  // ========================================
  'GET /wishlists': null, // Public - get all user wishlists
  'POST /wishlists': 'wishlist_create',
  'GET /wishlists/:id': 'wishlist_read',
  'GET /wishlists/:id/summary': 'wishlist_read',
  'PUT /wishlists/:id': 'wishlist_update',
  'DELETE /wishlists/:id': 'wishlist_delete',
  'GET /wishlists/:id/items': 'wishlist_read',
  'POST /wishlists/:id/items': 'wishlist_create',
  'PUT /wishlists/:id/items/:itemId': 'wishlist_update',
  'DELETE /wishlists/:id/items/:itemId': 'wishlist_delete',
  'POST /wishlists/:id/move-to-cart': 'wishlist_update',

  // ========================================
  // ADMIN ROUTES
  // ========================================
  
  // Admin - Category Routes
  'POST /admin/categories': 'categories_create',
  'PUT /admin/categories/:id': 'categories_update',
  'DELETE /admin/categories/:id': 'categories_delete',

  // Admin - Collection Routes
  'POST /admin/collections': 'collections_create',
  'PUT /admin/collections/:id': 'collections_update',
  'DELETE /admin/collections/:id': 'collections_delete',
  'POST /admin/collections/:id/products': 'collections_update',
  'DELETE /admin/collections/:id/products': 'collections_update',

  // Admin - Dashboard Routes
  'GET /admin/dashboard/metrics': 'analytics_dashboard',
  'GET /admin/dashboard/recent-orders': 'analytics_dashboard',
  'GET /admin/dashboard/top-selling-vendors': 'analytics_dashboard',
  'GET /admin/dashboard/top-selling-items': 'analytics_dashboard',
  'GET /admin/dashboard/sales-stats': 'analytics_dashboard',
  'GET /admin/dashboard/top-categories': 'analytics_dashboard',
  'GET /admin/dashboard/vendor-onboarding-stats': 'analytics_dashboard',
  'GET /admin/dashboard/vendor-overview/:vendorId': 'analytics_dashboard',
  'GET /admin/dashboard/products': 'products_read',

  // Admin - Inventory Routes
  'GET /admin/inventory/all': 'inventory_read',
  'GET /admin/inventory/vendor/:vendorId': 'inventory_read',
  'GET /admin/inventory/low-stock': 'inventory_read',
  'GET /admin/inventory/history': 'inventory_read',

  // Admin - Journal Routes
  'POST /admin/journal': 'journals_create',
  'PUT /admin/journal/:id': 'journals_update',
  'DELETE /admin/journal/:id': 'journals_delete',

  // Admin - Order Routes
  'GET /admin/orders': 'orders_read',
  'PATCH /admin/orders/:id/status': 'orders_update',

  // Admin - Product Routes
  'GET /admin/products/all': 'products_read',
  'POST /admin/products': 'products_create',
  'PUT /admin/products/:id': 'products_update',
  'DELETE /admin/products/:id': 'products_delete',
  'PATCH /admin/products/:id/status': 'products_update',
  'GET /admin/products/status/:status': 'products_read',
  'GET /admin/products/:id/analytics': 'products_analytics',

  // Admin - Subadmin Routes
  'GET /admin/subadmins': 'users_read',
  'POST /admin/subadmins': 'users_create',
  'GET /admin/subadmins/:id': 'users_read',
  'PATCH /admin/subadmins/:id': 'users_update',
  'DELETE /admin/subadmins/:id': 'users_delete',
  'PATCH /admin/subadmins/:id/permissions': 'users_update',
  'GET /admin/subadmins/permissions/all': 'users_read',
  'GET /admin/subadmins/roles/all': 'users_read',
  'GET /admin/subadmins/permission-groups/all': 'users_read',

  // Admin - Supply Routes
  'GET /admin/supplies/all': 'supplies_read',
  'GET /admin/supplies/vendor/:vendorId': 'supplies_read',
  'GET /admin/supplies/product/:productId': 'supplies_read',
  'GET /admin/supplies/summary': 'supplies_read',

  // Admin - Webhook Routes
  'GET /admin/webhooks/all': 'webhooks_read',
  'POST /admin/webhooks/test': 'webhooks_create',
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
  'GET /auth/logout',

  // Category routes
  'GET /categories',
  'GET /categories/tree',
  'GET /categories/:identifier',
  'GET /categories/:identifier/products',

  // Collection routes
  'GET /collections',
  'GET /collections/:id',
  'GET /collections/:id/products',

  // Dashboard routes
  'GET /dashboard/new-arrivals',
  'GET /dashboard/trending-now',
  'GET /dashboard/latest-journal',
  'GET /dashboard/product/:id',

  // Journal routes
  'GET /journals',
  'GET /journals/:id',

  // Order routes (webhooks)
  'POST /orders/webhook/payment',
  'GET /orders/verify-payment/:reference',

  // Product routes
  'GET /products/:productId/reviews',
  'GET /products/:identifier',
  'GET /products',
  'GET /products/vendor/:id',

  // Review routes
  'GET /reviews',
  'GET /reviews/:id',

  // Variant routes
  'GET /variants/types',
  'GET /variants/products/:productId/combinations',
  'GET /variants/combinations/:id',

  // Vendor routes
  'POST /vendors/register',
  'GET /vendors',
  'GET /vendors/:id/products',
  'GET /vendors/:id',

  // Webhook routes
  'POST /webhooks/paystack',
];