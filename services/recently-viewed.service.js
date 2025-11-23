const redis = require('../config/redis');
const { UserProductView, Product, Category, Vendor, Store, ProductImage } = require('../models');
const { Op } = require('sequelize');

class RecentlyViewedService {
  constructor() {
    this.maxViewsPerUser = parseInt(process.env.RECENTLY_VIEWED_LIMIT) || 10;
    this.defaultRetentionDays = parseInt(process.env.VIEW_DATA_RETENTION_DAYS) || 30;
    this.redisKeyPrefix = 'recent_views:';
  }

  /**
   * Get Redis key for user
   * @param {number} userId - User ID
   * @returns {string} Redis key
   */
  getRedisKey(userId) {
    return `${this.redisKeyPrefix}${userId}`;
  }

  /**
   * Track a product view for a user
   * @param {Object} params - Track parameters
   * @param {number} params.userId - User ID
   * @param {number} params.productId - Product ID
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Track result
   */
  async trackView({ userId, productId, metadata = {} }) {
    const transaction = await UserProductView.sequelize.transaction();

    try {
      // First, remove any existing view for this product by this user
      await UserProductView.destroy({
        where: {
          user_id: userId,
          product_id: productId
        },
        transaction
      });

      // Hash IP address for privacy (GDPR compliance)
      const crypto = require('crypto');
      const hashedIp = metadata.ipAddress ? crypto.createHash('sha256').update(metadata.ipAddress).digest('hex') : null;

      // Create new view record
      const viewRecord = await UserProductView.create({
        user_id: userId,
        product_id: productId,
        session_id: metadata.sessionId || null,
        ip_address: hashedIp,
        user_agent: metadata.userAgent || null,
        device_type: metadata.deviceType || 'unknown',
        referrer: metadata.referrer || null,
        viewed_at: new Date()
      }, { transaction });

      // Update Redis cache (push to front of list) - only if Redis is connected
      if (redis.isConnected) {
        try {
          const redisKey = this.getRedisKey(userId);
          await redis.lRem(redisKey, 0, productId.toString()); // Remove if exists
          await redis.lPush(redisKey, productId.toString());

          // Trim list to max size
          await redis.lTrim(redisKey, 0, this.maxViewsPerUser - 1);

          // Set expiration if not exists
          await redis.expire(redisKey, this.defaultRetentionDays * 24 * 60 * 60);
        } catch (redisError) {
          console.warn('Redis cache update failed:', redisError.message);
          // Continue without Redis - database is already updated
        }
      }

      await transaction.commit();

      return {
        success: true,
        viewId: viewRecord.id,
        timestamp: viewRecord.viewed_at
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to track view: ${error.message}`);
    }
  }

  /**
   * Get recently viewed products for a user
   * @param {Object} params - Query parameters
   * @param {number} params.userId - User ID
   * @param {number} params.limit - Number of products to return
   * @returns {Promise<Array>} Array of product objects
   */
  async getRecentViews({ userId, limit = 10 }) {
    try {
      const redisKey = this.getRedisKey(userId);
      let productIds = [];

      // Try Redis first for fast access (only if Redis is connected)
      if (redis.isConnected) {
        try {
          productIds = await redis.lRange(redisKey, 0, limit - 1);
        } catch (redisError) {
          console.warn('Redis error, falling back to database:', redisError.message);
          productIds = [];
        }
      }

      // If Redis is empty or unavailable, fall back to database
      let dbViews;
      if (productIds.length === 0) {
        dbViews = await UserProductView.findAll({
          where: { user_id: userId },
          attributes: ['product_id', 'viewed_at'],
          order: [['viewed_at', 'DESC']],
          limit: this.maxViewsPerUser
        });

        productIds = dbViews.map(view => view.product_id.toString());

        // Rebuild Redis cache - only if Redis is connected
        if (productIds.length > 0 && redis.isConnected) {
          try {
            await redis.del(redisKey);
            await redis.rPush(redisKey, ...productIds);
            await redis.expire(redisKey, this.defaultRetentionDays * 24 * 60 * 60);
          } catch (redisError) {
            console.warn('Redis cache rebuild failed:', redisError.message);
            // Continue without Redis cache
          }
        }
      }
      // Convert string IDs to integers early (fixes TDZ), fetch timestamps if needed
      const numericIds = productIds.map(id => parseInt(id)).filter(id => !isNaN(id));

      if (numericIds.length === 0) {
        return [];
      }

      // Fetch timestamps if not already fetched from DB fallback (Redis case)
      if (!dbViews) {
        dbViews = await UserProductView.findAll({
          where: { user_id: userId, product_id: { [Op.in]: numericIds } },
          attributes: ['product_id', 'viewed_at']
        });
      }

      // Get products with proper associations (only active products)
      const products = await Product.findAll({
        where: {
          id: { [Op.in]: numericIds },
          status: 'active'
        },
        attributes: [
          'id', 'vendor_id', 'category_id', 'name', 'slug', 'description',
          'thumbnail', 'price', 'discounted_price', 'sku', 'status',
          'impressions', 'sold_units', 'created_at', 'updated_at'
        ],
        include: [
          {
            model: Category,
            attributes: ['id', 'name', 'slug']
          },
          {
            model: Vendor,
            attributes: ['id', 'status'],
            as: 'vendor',
            include: [
              {
                model: Store,
                as: 'store',
                attributes: ['business_name']
              }
            ]
          },
          {
            model: ProductImage,
            limit: 1,
            as: 'images'
          }
        ]
      });

      // Sort products according to Redis order (most recent first)
      const productMap = new Map(products.map(p => [p.id, p]));
      const orderedProducts = [];

      for (const id of numericIds) {
        if (productMap.has(id)) {
          orderedProducts.push(productMap.get(id));
        }
      }

      // Use timestamps from initial dbViews query (optimization: no redundant query)
      const timestampMap = new Map(dbViews.map(v => [v.product_id, v.viewed_at]));

      return orderedProducts.map(product => {
        const viewedAt = timestampMap.get(product.id);
        return {
          ...product.toJSON(),
          viewed_at: viewedAt
        };
      });
    } catch (error) {
      throw new Error(`Failed to get recent views: ${error.message}`);
    }
  }

  /**
   * Clear all recently viewed products for a user
   * @param {Object} params - Parameters
   * @param {number} params.userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  async clearRecentViews({ userId }) {
    const transaction = await UserProductView.sequelize.transaction();

    try {
      // Delete from database
      const deletedCount = await UserProductView.destroy({
        where: { user_id: userId },
        transaction
      });

      // Clear Redis cache - only if Redis is connected
      if (redis.isConnected) {
        try {
          const redisKey = this.getRedisKey(userId);
          await redis.del(redisKey);
        } catch (redisError) {
          console.warn('Redis cache clear failed:', redisError.message);
          // Continue - database is already cleared
        }
      }

      await transaction.commit();

      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to clear recent views: ${error.message}`);
    }
  }

  /**
   * Get viewing statistics for a user
   * @param {Object} params - Parameters
   * @param {number} params.userId - User ID
   * @returns {Promise<Object>} Statistics object
   */
  async getViewStatistics({ userId }) {
    try {
      // Get statistics from database (only for active products)
      const [stats] = await UserProductView.sequelize.query(`
        SELECT
          COUNT(*) as totalViews,
          COUNT(DISTINCT upv.product_id) as uniqueProducts,
          MAX(upv.viewed_at) as lastViewDate
        FROM user_product_views upv
        INNER JOIN products p ON upv.product_id = p.id AND p.status = 'active'
        WHERE upv.user_id = :userId
      `, {
        replacements: { userId },
        type: UserProductView.sequelize.QueryTypes.SELECT
      });

      return {
        totalViews: parseInt(stats.totalViews) || 0,
        uniqueProducts: parseInt(stats.uniqueProducts) || 0,
        lastViewDate: stats.lastViewDate
      };
    } catch (error) {
      throw new Error(`Failed to get view statistics: ${error.message}`);
    }
  }

  /**
   * Anonymize user data for GDPR compliance
   * @param {number} userId - User ID to anonymize
   * @returns {Promise<Object>} Anonymization result
   */
  async anonymizeUserData(userId) {
    const transaction = await UserProductView.sequelize.transaction();

    try {
      // Anonymize personal data while keeping aggregate analytics
      const anonymizedCount = await UserProductView.update({
        session_id: null,
        ip_address: null,
        user_agent: null,
        device_type: 'anonymized',
        referrer: null
      }, {
        where: { user_id: userId },
        transaction
      });

      // Clear user's Redis cache - only if Redis is connected
      if (redis.isConnected) {
        try {
          const redisKey = this.getRedisKey(userId);
          await redis.del(redisKey);
        } catch (redisError) {
          console.warn('Redis cache clear failed:', redisError.message);
          // Continue - database is already anonymized
        }
      }

      await transaction.commit();

      return {
        success: true,
        anonymizedCount: Array.isArray(anonymizedCount) ? anonymizedCount[0] : anonymizedCount
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to anonymize user data: ${error.message}`);
    }
  }

  /**
   * Clean up old view records based on retention policy
   * @param {number} daysToKeep - Number of days to keep records
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldViews(daysToKeep = this.defaultRetentionDays) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await UserProductView.destroy({
        where: {
          viewed_at: {
            [Op.lt]: cutoffDate
          }
        }
      });

      return {
        success: true,
        deletedCount,
        cutoffDate
      };
    } catch (error) {
      throw new Error(`Failed to cleanup old views: ${error.message}`);
    }
  }

  /**
   * Get most viewed products across all users
   * @param {Object} params - Query parameters
   * @param {number} params.limit - Number of products to return
   * @param {number} params.days - Number of days to look back
   * @returns {Promise<Array>} Array of products with view counts
   */
  async getMostViewedProducts({ limit = 10, days = 7 } = {}) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [results] = await UserProductView.sequelize.query(`
        SELECT
          p.id,
          p.name,
          p.slug,
          p.description,
          p.price,
          p.discounted_price,
          p.thumbnail,
          c.name as category_name,
          s.business_name as vendor_name,
          COUNT(*) as view_count
        FROM user_product_views upv
        JOIN products p ON upv.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN vendors v ON p.vendor_id = v.id
        LEFT JOIN stores s ON v.id = s.id
        WHERE upv.viewed_at >= :startDate
        AND p.status = 'active'
        GROUP BY p.id, p.name, p.slug, p.description, p.price, p.discounted_price, p.thumbnail, c.name, s.business_name
        ORDER BY view_count DESC
        LIMIT :limit
      `, {
        replacements: {
          startDate: startDate.toISOString(),
          limit: parseInt(limit)
        },
        type: UserProductView.sequelize.QueryTypes.SELECT
      });

      return results;
    } catch (error) {
      throw new Error(`Failed to get most viewed products: ${error.message}`);
    }
  }
}

module.exports = new RecentlyViewedService();
