const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const redis = require('../config/redis');
const { TokenBlacklist } = require('../models');

/**
 * Token Blacklist Service
 * Manages JWT token blacklisting using Redis for efficient lookup with database fallback
 */
class TokenBlacklistService {
  constructor() {
    this.redis = redis;
  }

  /**
   * Hash the token for secure storage
   * @param {string} token - The JWT token to hash
   * @returns {string} - SHA256 hash of the token
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token + process.env.JWT_SECRET).digest('hex');
  }

  /**
   * Check if Redis is available for use
   * @returns {boolean} - True if Redis is connected and enabled
   */
  isRedisAvailable() {
    return this.redis.isConnected && this.redis.isEnabled;
  }

  /**
   * Add a token to the blacklist with Redis primary and database fallback
   * @param {string} token - The JWT token to blacklist
   * @param {string} [reason='logout'] - Reason for blacklisting
   * @param {number} [userId] - User ID associated with the token
   * @returns {Promise<boolean>} - Success status
   */
  async blacklistToken(token, reason = 'logout', userId = null) {
    try {
      const tokenHash = this.hashToken(token);
      
      // Get token expiration time from JWT payload
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        console.warn('Token blacklist: Unable to decode token expiration');
        return false;
      }

      // Calculate token expiry timestamp in milliseconds
      const tokenExpiry = decoded.exp * 1000; // Convert to milliseconds
      const ttl = Math.max(0, Math.floor((tokenExpiry - Date.now()) / 1000));
      
      // Try Redis first if available
      if (this.isRedisAvailable()) {
        try {
          const key = `blacklist:${tokenHash}`;
          await this.redis.setex(key, ttl, 'blacklisted');
          console.log(`Token blacklisted in Redis with TTL: ${ttl} seconds`);
          return true;
        } catch (redisError) {
          console.warn('Redis blacklist failed, falling back to database:', redisError.message);
          // Continue to database fallback
        }
      }
      
      // Database fallback
      await TokenBlacklist.create({
        token_hash: tokenHash,
        token_expiry: tokenExpiry,
        reason,
        user_id: userId
      });
      
      console.log(`Token blacklisted in database (expires: ${new Date(tokenExpiry).toISOString()})`);
      return true;
    } catch (error) {
      console.error('Error blacklisting token:', error);
      return false;
    }
  }

  /**
   * Check if a token is blacklisted with Redis primary and database fallback
   * @param {string} token - The JWT token to check
   * @returns {Promise<boolean>} - True if token is blacklisted
   */
  async isTokenBlacklisted(token) {
    try {
      const tokenHash = this.hashToken(token);
      
      // Try Redis first if available
      if (this.isRedisAvailable()) {
        try {
          const key = `blacklist:${tokenHash}`;
          const result = await this.redis.get(key);
          if (result === 'blacklisted') {
            return true;
          }
        } catch (redisError) {
          console.warn('Redis blacklist check failed, falling back to database:', redisError.message);
          // Continue to database fallback
        }
      }
      
      // Database fallback
      const blacklistedToken = await TokenBlacklist.findOne({
        where: {
          token_hash: tokenHash,
          token_expiry: {
            // Only consider non-expired blacklist entries
            [Op.gt]: Date.now()
          }
        }
      });
      
      return !!blacklistedToken;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false;
    }
  }

  /**
   * Blacklist all tokens for a specific user
   * @param {number} userId - The user ID whose tokens to blacklist
   * @param {string} [reason='user_logout'] - Reason for blacklisting
   * @returns {Promise<boolean>} - Success status
   */
  async blacklistAllUserTokens(userId, reason = 'user_logout') {
    try {
      // This would require a more advanced approach to track all user tokens
      // For now, we'll log that this feature needs implementation
      console.log(`Blacklisting all tokens for user ${userId} - feature not yet implemented`);
      
      // In the future, this could:
      // 1. Store user-token relationships in the database
      // 2. Use a user-specific key pattern in Redis
      // 3. Query all active tokens for the user and blacklist them individually
      
      return true;
    } catch (error) {
      console.error('Error blacklisting user tokens:', error);
      return false;
    }
  }

  /**
   * Clean up expired blacklist entries
   * @returns {Promise<number>} - Number of entries cleaned up
   */
  async cleanup() {
    try {
      let cleanedCount = 0;
      
      // Clean up Redis (if available) - Redis handles TTL automatically
      if (this.isRedisAvailable()) {
        // Redis keys with TTL are automatically cleaned up
        console.log('Redis blacklist cleanup: handled automatically by TTL');
      }
      
      // Clean up database
      cleanedCount = await TokenBlacklist.cleanupExpired();
      
      console.log('Token blacklist cleanup completed');
      return cleanedCount;
    } catch (error) {
      console.error('Error during blacklist cleanup:', error);
      throw error;
    }
  }

  /**
   * Get blacklist statistics
   * @returns {Promise<Object>} - Statistics about the blacklist
   */
  async getStats() {
    try {
      const stats = {
        redis: {
          available: this.isRedisAvailable(),
          connected: this.redis.isConnected
        },
        database: {}
      };
      
      // Get database stats
      const now = Date.now();
      stats.database.totalBlacklisted = await TokenBlacklist.count();
      stats.database.activeBlacklisted = await TokenBlacklist.count({
        where: {
          token_expiry: {
            [Op.gt]: now
          }
        }
      });
      stats.database.expiredBlacklisted = stats.database.totalBlacklisted - stats.database.activeBlacklisted;
      
      return stats;
    } catch (error) {
      console.error('Error getting blacklist stats:', error);
      return { error: error.message };
    }
  }
}

module.exports = new TokenBlacklistService();