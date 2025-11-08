const redis = require('../config/redis');

// Cache configuration and utilities
class CacheManager {
  constructor() {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheErrors = 0;
    
    // Cache key prefixes for organization
    this.prefixes = {
      admin: 'admin:',
      vendor: 'vendor:', 
      public: 'public:',
      dashboard: 'dashboard:',
      products: 'products:',
      users: 'users:',
      orders: 'orders:',
      analytics: 'analytics:'
    };

    // Default TTL values (in seconds) based on endpoint type
    this.defaultTTL = {
      // Static data - longer cache times
      categories: 1800,        // 30 minutes
      staticContent: 3600,     // 1 hour
      journal: 900,            // 15 minutes
      
      // Dynamic data - shorter cache times
      dashboard: 300,          // 5 minutes
      metrics: 300,            // 5 minutes  
      orders: 180,             // 3 minutes
      recent: 120,             // 2 minutes
      
      // User-specific data - shortest cache times
      user: 60,                // 1 minute
      vendor: 300,             // 5 minutes
      profile: 180,            // 3 minutes
    };

    // Endpoint-specific TTL mappings
    this.endpointTTL = {
      // Admin dashboard endpoints
      'admin:metrics': this.defaultTTL.dashboard,
      'admin:recent-orders': this.defaultTTL.recent,
      'admin:top-selling-vendors': this.defaultTTL.dashboard,
      'admin:top-selling-items': this.defaultTTL.dashboard,
      'admin:sales-stats': this.defaultTTL.metrics,
      'admin:top-categories': this.defaultTTL.dashboard,
      'admin:vendor-onboarding-stats': this.defaultTTL.metrics,
      'admin:vendor-overview': this.defaultTTL.metrics,
      'admin:products': this.defaultTTL.products,
      
      // Public dashboard endpoints
      'dashboard:new-arrivals': this.defaultTTL.public,
      'dashboard:trending-now': this.defaultTTL.public,
      'dashboard:latest-journal': this.defaultTTL.journal,
      'dashboard:product': this.defaultTTL.public,
      
      // Vendor dashboard endpoints
      'dashboard:vendor:metrics': this.defaultTTL.vendor,
      'dashboard:vendor:products': this.defaultTTL.vendor,
      'dashboard:vendor:earnings': this.defaultTTL.vendor,
      'dashboard:vendor:earnings-breakdown': this.defaultTTL.vendor,
    };
  }

  /**
   * Generate cache key with proper prefix and naming convention
   * @param {string} type - Cache type prefix
   * @param {string} endpoint - Endpoint path
   * @param {Object} params - Query parameters
   * @returns {string} Formatted cache key
   */
  generateKey(type, endpoint, params = {}) {
    const prefix = this.prefixes[type] || this.prefixes.public;
    const baseKey = `${prefix}${endpoint}`;
    
    // Add query parameters to key for cache differentiation
    if (Object.keys(params).length > 0) {
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}:${params[key]}`)
        .join(':');
      return `${baseKey}:${sortedParams}`;
    }
    
    return baseKey;
  }

  /**
   * Get TTL for specific endpoint
   * @param {string} type - Cache type
   * @param {string} endpoint - Endpoint path
   * @param {Object} params - Query parameters
   * @returns {number} TTL in seconds
   */
  getTTL(type, endpoint, params = {}) {
    const key = this.generateKey(type, endpoint, params);
    
    // Check for specific endpoint mapping
    if (this.endpointTTL[key]) {
      return this.endpointTTL[key];
    }
    
    // Fallback to type-based TTL
    const typeTTL = this.defaultTTL[type] || this.defaultTTL.public;
    return typeTTL;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      errors: this.cacheErrors,
      hitRate: this.cacheHits + this.cacheMisses > 0 
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats() {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheErrors = 0;
  }

  /**
   * Invalidate cache by pattern
   * @param {string} pattern - Cache key pattern (supports wildcards)
   * @returns {Promise<number>} Number of deleted keys
   */
  async invalidatePattern(pattern) {
    try {
      if (!redis.isConnected) {
        console.warn('Redis not connected, cannot invalidate pattern:', pattern);
        return 0;
      }

      // Note: This would need SCAN command implementation in real Redis
      // For now, we'll skip pattern-based invalidation
      console.log('Cache invalidation requested for pattern:', pattern);
      return 0;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      this.cacheErrors++;
      return 0;
    }
  }

  /**
   * Invalidate specific cache keys
   * @param {Array<string>} keys - Array of cache keys to delete
   * @returns {Promise<number>} Number of deleted keys
   */
  async invalidateKeys(keys) {
    try {
      if (!redis.isConnected) {
        console.warn('Redis not connected, cannot invalidate keys');
        return 0;
      }

      if (!Array.isArray(keys) || keys.length === 0) {
        return 0;
      }

      const deletedCount = await redis.del(...keys);
      console.log(`Cache invalidation: deleted ${deletedCount} keys`);
      return deletedCount;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      this.cacheErrors++;
      return 0;
    }
  }
}

// Create cache manager instance
const cacheManager = new CacheManager();

/**
 * Enhanced cache middleware factory
 * @param {number|Object} options - Cache options
 * @param {string} options.ttl - Time to live in seconds
 * @param {string} options.type - Cache type prefix
 * @param {boolean} options.skipCache - Skip caching for this request
 * @param {Function} options.keyGenerator - Custom key generator
 * @param {string} options.invalidateOn - Events that should invalidate this cache
 * @returns {Function} Express middleware
 */
const cache = (options = {}) => {
  // Handle both number and object options
  const config = {
    ttl: typeof options === 'number' ? options : options.ttl || 300,
    type: typeof options === 'object' ? options.type || 'public' : 'public',
    skipCache: typeof options === 'object' ? options.skipCache || false : false,
    keyGenerator: typeof options === 'object' ? options.keyGenerator : null,
    invalidateOn: typeof options === 'object' ? options.invalidateOn || [] : [],
    ...options
  };

  return async (req, res, next) => {
    // Skip caching if explicitly disabled
    if (config.skipCache || !redis.isEnabled) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = config.keyGenerator 
        ? config.keyGenerator(req)
        : cacheManager.generateKey(config.type, req.path, req.query);

      // Try to get cached data
      try {
        const cachedData = await redis.get(cacheKey);
        
        if (cachedData) {
          cacheManager.cacheHits++;
          console.log(`Cache HIT: ${cacheKey}`);
          
          // Parse cached data and send response
          const data = JSON.parse(cachedData);
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey);
          return res.status(200).json({
            status: 'success',
            ...data,
            cached: true,
            cached_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.warn(`Cache read error for key ${cacheKey}:`, error.message);
        cacheManager.cacheErrors++;
      }

      cacheManager.cacheMisses++;
      console.log(`Cache MISS: ${cacheKey}`);

      // Cache miss - proceed to controller and cache response
      const originalSend = res.json;
      res.json = function(data) {
        // Set cache headers
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        
        // Determine TTL
        const ttl = config.ttl || cacheManager.getTTL(config.type, req.path, req.query);
        
        // Cache successful responses only (status 200)
        if (res.statusCode === 200 && data && data.status === 'success') {
          try {
            const dataToCache = {
              ...data,
              // Remove caching metadata from cached data
              cached: undefined,
              cached_at: undefined
            };
            
            // Use setex for automatic expiration
            redis.setex(cacheKey, ttl, JSON.stringify(dataToCache))
              .then(() => {
                console.log(`Cache SET: ${cacheKey} (TTL: ${ttl}s)`);
              })
              .catch(error => {
                console.warn(`Cache write error for key ${cacheKey}:`, error.message);
                cacheManager.cacheErrors++;
              });
          } catch (error) {
            console.warn(`Cache serialization error for key ${cacheKey}:`, error.message);
            cacheManager.cacheErrors++;
          }
        }

        // Call original response method
        originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      cacheManager.cacheErrors++;
      // Continue without caching
      next();
    }
  };
};

/**
 * Cache invalidation helper functions
 */
const invalidate = {
  /**
   * Invalidate cache when admin data changes
   * @param {Object} options - Invalidation options
   */
  admin: async (options = {}) => {
    const keys = [
      cacheManager.generateKey('admin', '/metrics'),
      cacheManager.generateKey('admin', '/recent-orders'),
      cacheManager.generateKey('admin', '/top-selling-vendors'),
      cacheManager.generateKey('admin', '/top-selling-items'),
      cacheManager.generateKey('admin', '/sales-stats'),
      cacheManager.generateKey('admin', '/top-categories'),
      cacheManager.generateKey('admin', '/vendor-onboarding-stats'),
      cacheManager.generateKey('admin', '/products'),
    ];
    
    // Add specific vendor overview if vendorId provided
    if (options.vendorId) {
      keys.push(cacheManager.generateKey('admin', `/vendor-overview/${options.vendorId}`));
    }
    
    return await cacheManager.invalidateKeys(keys);
  },

  /**
   * Invalidate cache when vendor data changes
   * @param {Object} options - Invalidation options
   */
  vendor: async (options = {}) => {
    const keys = [
      cacheManager.generateKey('dashboard', '/vendor/metrics'),
      cacheManager.generateKey('dashboard', '/vendor/products'),
      cacheManager.generateKey('dashboard', '/vendor/earnings'),
      cacheManager.generateKey('dashboard', '/vendor/earnings-breakdown'),
    ];
    
    return await cacheManager.invalidateKeys(keys);
  },

  /**
   * Invalidate cache when product data changes
   * @param {Object} options - Invalidation options
   */
  product: async (options = {}) => {
    const keys = [
      cacheManager.generateKey('public', '/new-arrivals'),
      cacheManager.generateKey('public', '/trending-now'),
    ];
    
    if (options.productId) {
      keys.push(cacheManager.generateKey('public', `/product/${options.productId}`));
    }
    
    return await cacheManager.invalidateKeys(keys);
  },

  /**
   * Invalidate all dashboard caches
   */
  all: async () => {
    try {
      // This would require SCAN command in real Redis implementation
      console.log('Invalidating all cache entries');
      return 0;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }
};

module.exports = {
  cache,
  cacheManager,
  invalidate
};