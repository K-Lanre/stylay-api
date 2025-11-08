// test/enhanced-wishlist.test.js
const request = require('supertest');
const app = require('../app');
const { Wishlist, WishlistItem, Product, ProductVariant } = require('../models');

describe('Enhanced Wishlist System', () => {
  let authToken;
  let testUser;
  let testProduct;
  let testVariants;
  let testWishlist;

  beforeAll(async () => {
    // Setup test data
    testUser = await User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      password: 'hashedpassword'
    });

    testProduct = await Product.create({
      name: 'Test Product',
      slug: 'test-product',
      price: 100.00,
      status: 'active'
    });

    testVariants = await ProductVariant.bulkCreate([
      {
        product_id: testProduct.id,
        name: 'Color',
        value: 'Red',
        additional_price: 10.00
      },
      {
        product_id: testProduct.id,
        name: 'Size',
        value: 'L',
        additional_price: 5.00
      }
    ]);

    testWishlist = await Wishlist.create({
      user_id: testUser.id,
      name: 'Test Wishlist',
      is_default: true
    });

    // Get auth token
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password'
      });
    
    authToken = response.body.data.token;
  });

  describe('POST /api/v1/wishlists/:id/items - Add item with multiple variants', () => {
    it('should add item with multiple selected_variants', async () => {
      const response = await request(app)
        .post(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProduct.id,
          selected_variants: [
            {
              id: testVariants[0].id,
              name: 'Color',
              value: 'Red',
              additional_price: 10.00
            },
            {
              id: testVariants[1].id,
              name: 'Size',
              value: 'L',
              additional_price: 5.00
            }
          ],
          quantity: 2,
          priority: 'high'
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.selected_variants).toHaveLength(2);
      expect(response.body.data.total_price).toBe(230.00); // (100 + 10 + 5) * 2
    });

    it('should handle legacy variant_id for backward compatibility', async () => {
      const response = await request(app)
        .post(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProduct.id,
          variant_id: testVariants[0].id,
          quantity: 1,
          priority: 'medium'
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.selected_variants).toHaveLength(1);
      expect(response.body.data.variant_id).toBe(testVariants[0].id);
      expect(response.body.data.total_price).toBe(110.00); // 100 + 10
    });

    it('should update existing item when same variants are added', async () => {
      // Add item first
      await request(app)
        .post(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProduct.id,
          selected_variants: [
            {
              id: testVariants[0].id,
              name: 'Color',
              value: 'Red',
              additional_price: 10.00
            }
          ],
          quantity: 1
        });

      // Add same item again
      const response = await request(app)
        .post(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProduct.id,
          selected_variants: [
            {
              id: testVariants[0].id,
              name: 'Color',
              value: 'Red',
              additional_price: 10.00
            }
          ],
          quantity: 2
        });

      expect(response.status).toBe(201);
      expect(response.body.data.quantity).toBe(3); // 1 + 2
      expect(response.body.data.total_price).toBe(330.00); // (100 + 10) * 3
    });
  });

  describe('GET /api/v1/wishlists/:id - Get wishlist with totals', () => {
    it('should return wishlist with calculated totals', async () => {
      const response = await request(app)
        .get(`/api/v1/wishlists/${testWishlist.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.total_items).toBeGreaterThan(0);
      expect(response.body.data.total_amount).toBeGreaterThan(0);
      expect(response.body.data.items).toBeDefined();
    });
  });

  describe('GET /api/v1/wishlists/:id/items - Get wishlist items with variants', () => {
    it('should return items with selected_variants and total_price', async () => {
      const response = await request(app)
        .get(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeInstanceOf(Array);
      
      if (response.body.data.length > 0) {
        expect(response.body.data[0].selected_variants).toBeDefined();
        expect(response.body.data[0].total_price).toBeDefined();
        expect(response.body.data[0].price).toBeDefined();
      }
    });
  });

  describe('PUT /api/v1/wishlists/:id/items/:itemId - Update item quantity', () => {
    it('should update item quantity and recalculate total_price', async () => {
      // First, get an item from the wishlist
      const itemsResponse = await request(app)
        .get(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`);

      if (itemsResponse.body.data.length > 0) {
        const itemId = itemsResponse.body.data[0].id;
        const oldTotalPrice = itemsResponse.body.data[0].total_price;

        const response = await request(app)
          .put(`/api/v1/wishlists/${testWishlist.id}/items/${itemId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            quantity: 5,
            notes: 'Updated quantity'
          });

        expect(response.status).toBe(200);
        expect(response.body.data.quantity).toBe(5);
        expect(response.body.data.total_price).toBe(oldTotalPrice * 5);
      }
    });
  });

  describe('DELETE /api/v1/wishlists/:id/items/:itemId - Remove item', () => {
    it('should remove item and update wishlist totals', async () => {
      // First, get an item from the wishlist
      const itemsResponse = await request(app)
        .get(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`);

      if (itemsResponse.body.data.length > 0) {
        const itemId = itemsResponse.body.data[0].id;

        const response = await request(app)
          .delete(`/api/v1/wishlists/${testWishlist.id}/items/${itemId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
      }
    });
  });

  describe('Error handling', () => {
    it('should return error for invalid variant ID', async () => {
      const response = await request(app)
        .post(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProduct.id,
          selected_variants: [
            {
              id: 99999, // Invalid variant ID
              name: 'Invalid',
              value: 'Invalid',
              additional_price: 0
            }
          ],
          quantity: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });

    it('should return error for duplicate variant IDs', async () => {
      const response = await request(app)
        .post(`/api/v1/wishlists/${testWishlist.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: testProduct.id,
          selected_variants: [
            {
              id: testVariants[0].id,
              name: 'Color',
              value: 'Red',
              additional_price: 10.00
            },
            {
              id: testVariants[0].id, // Duplicate
              name: 'Color',
              value: 'Red',
              additional_price: 10.00
            }
          ],
          quantity: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  afterAll(async () => {
    // Cleanup
    await WishlistItem.destroy({ where: {} });
    await Wishlist.destroy({ where: {} });
    await ProductVariant.destroy({ where: { product_id: testProduct.id } });
    await Product.destroy({ where: { id: testProduct.id } });
    await User.destroy({ where: { id: testUser.id } });
  });
});