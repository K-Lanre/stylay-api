const request = require('supertest');
const app = require('../app');
const { sequelize, User, Product, Category, Vendor, Store, UserProductView } = require('../models');

describe('Recently Viewed Products API', () => {
  let user, token, product1, product2, product3;

  beforeAll(async () => {
    // Setup test data
    const userData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'testuser@example.com',
      password: 'password123'
    };

    const categoryData = {
      name: 'Electronics',
      slug: 'electronics'
    };

    const storeData = {
      business_name: 'Test Store',
      business_type: 'retail'
    };

    user = await User.create(userData);
    
    // Create vendor
    const category = await Category.create(categoryData);
    const store = await Store.create(storeData);
    const vendor = await Vendor.create({
      user_id: user.id,
      store_id: store.id,
      status: 'approved'
    });

    // Create test products
    product1 = await Product.create({
      vendor_id: vendor.id,
      category_id: category.id,
      name: 'Product 1',
      slug: 'product-1',
      description: 'Test product 1',
      price: 99.99,
      sku: 'TEST-001',
      status: 'active'
    });

    product2 = await Product.create({
      vendor_id: vendor.id,
      category_id: category.id,
      name: 'Product 2',
      slug: 'product-2',
      description: 'Test product 2',
      price: 199.99,
      sku: 'TEST-002',
      status: 'active'
    });

    product3 = await Product.create({
      vendor_id: vendor.id,
      category_id: category.id,
      name: 'Product 3',
      slug: 'product-3',
      description: 'Test product 3',
      price: 299.99,
      sku: 'TEST-003',
      status: 'active'
    });

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'testuser@example.com',
        password: 'password123'
      });

    token = loginResponse.body.data.token;
  });

  afterAll(async () => {
    // Cleanup
    await UserProductView.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Vendor.destroy({ where: {} });
    await Store.destroy({ where: {} });
    await Category.destroy({ where: {} });
    await User.destroy({ where: {} });
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clear views before each test
    await UserProductView.destroy({ where: { user_id: user.id } });
  });

  describe('POST /api/v1/products/:identifier - Product View Tracking', () => {
    it('should track product view when authenticated user views product', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${product1.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify view was tracked
      const viewCount = await UserProductView.count({
        where: { user_id: user.id, product_id: product1.id }
      });
      expect(viewCount).toBe(1);
    });

    it('should not track view for unauthenticated user', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${product1.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify no view was tracked
      const viewCount = await UserProductView.count({
        where: { user_id: user.id, product_id: product1.id }
      });
      expect(viewCount).toBe(0);
    });
  });

  describe('GET /api/v1/products/recent - Get Recently Viewed', () => {
    it('should return empty array when no views exist', async () => {
      const response = await request(app)
        .get('/api/v1/products/recent')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toEqual([]);
    });

    it('should return recently viewed products ordered by most recent', async () => {
      // Track multiple product views
      await request(app)
        .get(`/api/v1/products/${product1.id}`)
        .set('Authorization', `Bearer ${token}`);

      await new Promise(resolve => setTimeout(resolve, 100)); // Ensure time difference

      await request(app)
        .get(`/api/v1/products/${product2.id}`)
        .set('Authorization', `Bearer ${token}`);

      const response = await request(app)
        .get('/api/v1/products/recent')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);

      // Should be ordered by most recent first
      expect(response.body.data[0].id).toBe(product2.id);
      expect(response.body.data[1].id).toBe(product1.id);
    });

    it('should respect limit parameter', async () => {
      // Track multiple views
      await request(app)
        .get(`/api/v1/products/${product1.id}`)
        .set('Authorization', `Bearer ${token}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .get(`/api/v1/products/${product2.id}`)
        .set('Authorization', `Bearer ${token}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .get(`/api/v1/products/${product3.id}`)
        .set('Authorization', `Bearer ${token}`);

      const response = await request(app)
        .get('/api/v1/products/recent?limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/products/recent');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/products/recent - Clear Recent Views', () => {
    it('should clear all recent views for user', async () => {
      // Track some views first
      await request(app)
        .get(`/api/v1/products/${product1.id}`)
        .set('Authorization', `Bearer ${token}`);

      await request(app)
        .get(`/api/v1/products/${product2.id}`)
        .set('Authorization', `Bearer ${token}`);

      // Verify views exist
      let viewCount = await UserProductView.count({
        where: { user_id: user.id }
      });
      expect(viewCount).toBe(2);

      // Clear views
      const response = await request(app)
        .delete('/api/v1/products/recent')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(2);

      // Verify views are cleared
      viewCount = await UserProductView.count({
        where: { user_id: user.id }
      });
      expect(viewCount).toBe(0);
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .delete('/api/v1/products/recent');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/products/recent/stats - View Statistics', () => {
    it('should return view statistics', async () => {
      // Track some views
      await request(app)
        .get(`/api/v1/products/${product1.id}`)
        .set('Authorization', `Bearer ${token}`);

      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .get(`/api/v1/products/${product2.id}`)
        .set('Authorization', `Bearer ${token}`);

      // View same product again (should update, not create new)
      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .get(`/api/v1/products/${product1.id}`)
        .set('Authorization', `Bearer ${token}`);

      const response = await request(app)
        .get('/api/v1/products/recent/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalViews).toBe(3);
      expect(response.body.data.uniqueProducts).toBe(2);
      expect(response.body.data.lastViewDate).toBeTruthy();
    });

    it('should return zeros for user with no views', async () => {
      const response = await request(app)
        .get('/api/v1/products/recent/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalViews).toBe(0);
      expect(response.body.data.uniqueProducts).toBe(0);
      expect(response.body.data.lastViewDate).toBeNull();
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/products/recent/stats');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/products/recent/anonymize - GDPR Anonymization', () => {
    it('should anonymize user view data', async () => {
      // Track a view
      await request(app)
        .get(`/api/v1/products/${product1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', 'Test Browser')
        .set('X-Forwarded-For', '192.168.1.1');

      // Verify original data exists
      let view = await UserProductView.findOne({
        where: { user_id: user.id, product_id: product1.id }
      });
      expect(view.ip_address).toBe('192.168.1.1');
      expect(view.user_agent).toBe('Test Browser');

      // Anonymize data
      const response = await request(app)
        .patch('/api/v1/products/recent/anonymize')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify data is anonymized
      view = await UserProductView.findOne({
        where: { user_id: user.id, product_id: product1.id }
      });
      expect(view.ip_address).toBeNull();
      expect(view.user_agent).toBeNull();
      expect(view.device_type).toBe('anonymized');
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .patch('/api/v1/products/recent/anonymize');

      expect(response.status).toBe(401);
    });
  });
});