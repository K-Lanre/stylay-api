const request = require('supertest');
const express = require('express');
const { checkPermission } = require('../middlewares/checkPermission');
const { User, Role, Permission } = require('../models');

// Mock models and services
jest.mock('../models');
jest.mock('../services/permission.service');
jest.mock('../config/permission-mapping');

describe('CheckPermission Middleware', () => {
  let app;
  let mockUser;
  let mockAdminUser;
  let mockVendorUser;
  let mockPublicUser;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock permission mapping functions
    const {
      generateRouteKey,
      isPublicRoute,
      getRequiredPermission
    } = require('../config/permission-mapping');
    
    // Set up test routes
    app.post('/test/public', checkPermission, (req, res) => {
      res.json({ message: 'Public route accessed' });
    });

    app.post('/test/protected', checkPermission, (req, res) => {
      res.json({ message: 'Protected route accessed' });
    });

    app.post('/test/admin', checkPermission, (req, res) => {
      res.json({ message: 'Admin route accessed' });
    });

    app.post('/test/vendor', checkPermission, (req, res) => {
      res.json({ message: 'Vendor route accessed' });
    });

    // Mock users
    mockUser = {
      id: 1,
      roles: [
        {
          name: 'customer',
          permissions: [
            { name: 'products_read' },
            { name: 'orders_create' }
          ]
        }
      ]
    };

    mockAdminUser = {
      id: 2,
      roles: [
        {
          name: 'admin',
          permissions: [
            { name: 'users_manage' },
            { name: 'products_create' }
          ]
        }
      ]
    };

    mockVendorUser = {
      id: 3,
      roles: [
        {
          name: 'vendor',
          permissions: [
            { name: 'products_create' },
            { name: 'inventory_update' }
          ]
        }
      ]
    };

    mockPublicUser = {
      id: 4,
      roles: []
    };

    // Mock permission mapping responses
    generateRouteKey.mockReturnValue('POST /test/public');
    isPublicRoute.mockImplementation((method, path) => path.includes('/test/public'));
    getRequiredPermission.mockImplementation((method, path) => {
      if (path.includes('/test/admin')) return 'users_manage';
      if (path.includes('/test/vendor')) return 'products_create';
      if (path.includes('/test/protected')) return 'products_read';
      return null;
    });

    // Mock PermissionService
    const PermissionService = require('../services/permission.service');
    PermissionService.checkPermission.mockImplementation((user, permission) => {
      if (user.id === 2) return true; // Admin user has all permissions
      if (user.id === 3) {
        return permission === 'products_create' || permission === 'inventory_update';
      }
      if (user.id === 1) {
        return permission === 'products_read' || permission === 'orders_create';
      }
      return false;
    });

    PermissionService.getUserPermissions.mockResolvedValue([
      { id: 1, name: 'products_read' },
      { id: 2, name: 'orders_create' }
    ]);

    PermissionService.hasAdminRole.mockImplementation((user) => {
      return user.roles.some(role => role.name === 'admin');
    });
  });

  describe('Public Route Access', () => {
    test('should allow access to public routes without authentication', async () => {
      const response = await request(app)
        .post('/test/public')
        .expect(200);

      expect(response.body.message).toBe('Public route accessed');
    });

    test('should allow access to public routes with authentication', async () => {
      const response = await request(app)
        .post('/test/public')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.message).toBe('Public route accessed');
    });
  });

  describe('Protected Route Access', () => {
    test('should deny access without authentication', async () => {
      const response = await request(app)
        .post('/test/protected')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });

    test('should deny access with invalid authentication', async () => {
      const response = await request(app)
        .post('/test/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });

    test('should allow access with valid authentication and permission', async () => {
      const response = await request(app)
        .post('/test/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.message).toBe('Protected route accessed');
    });

    test('should deny access with valid authentication but insufficient permission', async () => {
      const response = await request(app)
        .post('/test/admin')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access denied');
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('User Context Setting', () => {
    test('should set vendor context for vendor users', async () => {
      // Mock vendor user with vendor profile
      const { Vendor } = require('../models');
      Vendor.findOne.mockResolvedValue({
        id: 123,
        status: 'active'
      });

      const response = await request(app)
        .post('/test/vendor')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(Vendor.findOne).toHaveBeenCalledWith({
        where: { user_id: 3 },
        attributes: ['id', 'status']
      });
    });

    test('should handle vendor user without profile', async () => {
      // Mock vendor user without vendor profile
      const { Vendor } = require('../models');
      Vendor.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/test/vendor')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    test('should handle internal server errors gracefully', async () => {
      // Mock PermissionService to throw error
      const PermissionService = require('../services/permission.service');
      PermissionService.checkPermission.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/test/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Internal server error');
      expect(response.body.code).toBe('PERMISSION_CHECK_ERROR');
    });
  });

  describe('Helper Functions', () => {
    test('generateRouteKey should create correct route keys', () => {
      const { generateRouteKey } = require('../config/permission-mapping');
      
      expect(generateRouteKey('GET', '/products/123')).toBe('GET /products/:id');
      expect(generateRouteKey('POST', '/auth/login')).toBe('POST /auth/login');
    });

    test('isPublicRoute should correctly identify public routes', () => {
      const { isPublicRoute } = require('../config/permission-mapping');
      
      expect(isPublicRoute('GET', '/categories')).toBe(true);
      expect(isPublicRoute('POST', '/products')).toBe(false);
    });

    test('getRequiredPermission should return correct permissions', () => {
      const { getRequiredPermission } = require('../config/permission-mapping');
      
      expect(getRequiredPermission('POST', '/auth/register')).toBeNull();
      expect(getRequiredPermission('GET', '/products')).toBe('products_read');
    });
  });

  describe('Convenience Middleware Functions', () => {
    test('requireSpecificPermission should work correctly', () => {
      const { requireSpecificPermission } = require('../middlewares/checkPermission');
      
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/test/specific', requireSpecificPermission('products_create'), (req, res) => {
        res.json({ message: 'Permission granted' });
      });

      return request(testApp)
        .post('/test/specific')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });

    test('requireAnyPermission should work correctly', () => {
      const { requireAnyPermission } = require('../middlewares/checkPermission');
      
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/test/any', requireAnyPermission(['products_read', 'users_manage']), (req, res) => {
        res.json({ message: 'Permission granted' });
      });

      return request(testApp)
        .post('/test/any')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });
  });

  describe('Session Caching', () => {
    test('should use session cache for permission checks', async () => {
      const mockSession = {
        userPermissions: ['products_read', 'orders_create'],
        permissionsTimestamp: Date.now() - 1800000 // 30 minutes ago (within 1 hour)
      };

      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.session = mockSession;
        next();
      });

      // The middleware should use cached permissions
      const response = await request(testApp)
        .post('/test/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });

    test('should refresh cache when expired', async () => {
      const mockSession = {
        userPermissions: ['products_read'],
        permissionsTimestamp: Date.now() - 7200000 // 2 hours ago (expired)
      };

      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.session = mockSession;
        next();
      });

      // Should refresh the cache
      const response = await request(testApp)
        .post('/test/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(mockSession.permissionsTimestamp).toBeGreaterThan(Date.now() - 1000);
    });
  });
});

describe('Permission Mapping Configuration', () => {
  test('should export correct structure', () => {
    const { permissionMap, publicRoutes } = require('../config/permission-mapping');
    
    expect(typeof permissionMap).toBe('object');
    expect(Array.isArray(publicRoutes)).toBe(true);
    expect(publicRoutes.length).toBeGreaterThan(0);
  });

  test('should have helper functions', () => {
    const {
      generateRouteKey,
      isPublicRoute,
      getRequiredPermission,
      getAllRoutes,
      getPublicRoutes,
      getRoutesByPermission,
      getRoutesByResource
    } = require('../config/permission-mapping');

    expect(typeof generateRouteKey).toBe('function');
    expect(typeof isPublicRoute).toBe('function');
    expect(typeof getRequiredPermission).toBe('function');
    expect(typeof getAllRoutes).toBe('function');
    expect(typeof getPublicRoutes).toBe('function');
    expect(typeof getRoutesByPermission).toBe('function');
    expect(typeof getRoutesByResource).toBe('function');
  });

  test('getAllRoutes should return all configured routes', () => {
    const { getAllRoutes } = require('../config/permission-mapping');
    const routes = getAllRoutes();
    
    expect(Object.keys(routes).length).toBeGreaterThan(50); // Should have 100+ routes
    expect(routes['POST /auth/register']).toBeNull(); // Public route
    expect(routes['GET /products']).toBe('products_read'); // Protected route
  });

  test('getPublicRoutes should return all public routes', () => {
    const { getPublicRoutes } = require('../config/permission-mapping');
    const publicRoutes = getPublicRoutes();
    
    expect(publicRoutes).toContain('POST /auth/register');
    expect(publicRoutes).toContain('GET /products');
    expect(publicRoutes).toContain('GET /categories');
  });

  test('getRoutesByPermission should filter routes correctly', () => {
    const { getRoutesByPermission } = require('../config/permission-mapping');
    const productRoutes = getRoutesByPermission('products_create');
    
    expect(productRoutes).toContain('POST /products');
    expect(productRoutes).toContain('POST /admin/products');
  });

  test('getRoutesByResource should filter routes by resource', () => {
    const { getRoutesByResource } = require('../config/permission-mapping');
    const vendorRoutes = getRoutesByResource('vendors');
    
    expect(vendorRoutes.length).toBeGreaterThan(0);
    expect(vendorRoutes.every(route => route.includes('/vendors'))).toBe(true);
  });
});

// Integration test
describe('CheckPermission Integration', () => {
  test('should work with real Express application structure', async () => {
    const testApp = express();
    testApp.use(express.json());

    // Import middleware after mocking
    const { checkPermission } = require('../middlewares/checkPermission');

    // Test route with CheckPermission
    testApp.get('/test/integration', checkPermission, (req, res) => {
      res.json({ 
        message: 'Integration test passed',
        user: req.user ? 'authenticated' : 'anonymous',
        permissionCheck: req.permissionCheck
      });
    });

    const response = await request(testApp)
      .get('/test/integration')
      .expect(401); // Should fail without authentication

    expect(response.body.success).toBe(false);
  });
});
