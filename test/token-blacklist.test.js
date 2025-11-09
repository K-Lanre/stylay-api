const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { User, Role } = require('../models');
const tokenBlacklistService = require('../services/token-blacklist.service');

describe('Token Blacklisting Tests', () => {
  let authToken;
  let user;

  beforeEach(async () => {
    // Create a test user
    const testRole = await Role.findOne({ where: { name: 'customer' } });
    user = await User.create({
      first_name: 'Test',
      last_name: 'User',
      email: 'testuser@example.com',
      phone: '+2348012345678',
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3K7J5X1F26', // password123
      email_verified_at: new Date(),
      is_active: true,
    });
    
    if (testRole) {
      await user.addRole(testRole);
    }

    // Generate auth token
    authToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (user) {
      await user.destroy();
    }
  });

  test('should allow access with valid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.status).toBe('success');
  });

  test('should reject access with blacklisted token', async () => {
    // First blacklist the token
    await tokenBlacklistService.blacklistToken(authToken);

    // Then try to access protected route
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(401);

    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Token has been invalidated. Please log in again.');
  });

  test('should blacklist token on logout', async () => {
    // Perform logout
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.status).toBe('success');

    // Verify token is blacklisted
    const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(authToken);
    expect(isBlacklisted).toBe(true);
  });

  test('should reject requests with blacklisted token after logout', async () => {
    // First logout to blacklist the token
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Then try to access protected route
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(401);

    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Token has been invalidated. Please log in again.');
  });
});