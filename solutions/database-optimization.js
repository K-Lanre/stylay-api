/**
 * Database Configuration Optimization for Lock Contention Prevention
 * 
 * Optimizations:
 * 1. Connection pool tuning
 * 2. Transaction isolation levels
 * 3. Query optimization settings
 * 4. InnoDB configuration recommendations
 */

const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

class DatabaseOptimization {
  /**
   * Optimized database configuration
   */
  static getOptimizedConfig() {
    return {
      // Connection pool optimization for high concurrency
      pool: {
        max: 15, // Increased from 5 to handle more concurrent operations
        min: 2,  // Increased minimum connections
        acquire: 45000, // Increased timeout (45s) from 30s
        idle: 20000,    // Increased idle timeout (20s) from 10s
        evict: 5000,    // Add eviction interval
        handleDisconnects: true
      },
      
      // Query optimization
      logging: process.env.NODE_ENV === 'development' ? 
        (sql, timing) => {
          if (timing > 1000) { // Log slow queries (>1s)
            logger.warn(`SLOW QUERY (>${timing}ms): ${sql}`);
          }
        } : false,
      
      // Transaction settings
      transactionType: 'IMMEDIATE',
      
      // Retry configuration for lock timeout errors
      retry: {
        match: [
          /ER_LOCK_DEADLOCK/,
          /ER_LOCK_WAIT_TIMEOUT/,
          /SequelizeDatabaseError/
        ],
        max: 3
      },
      
      // Dialect-specific options
      dialectOptions: {
        supportBigNumbers: true,
        bigNumberStrings: true,
        // Connection timeout settings
        connectTimeout: 60000,
        acquireTimeout: 45000,
        timeout: 45000,
        // SSL configuration for production
        ssl: process.env.NODE_ENV === 'production' ? {
          require: true,
          rejectUnauthorized: false
        } : false
      },
      
      // Additional performance settings
      benchmark: process.env.NODE_ENV === 'development',
      hooks: {
        beforeConnect: (config) => {
          logger.info('Optimized database connection established');
        }
      }
    };
  }

  /**
   * Apply optimized configuration
   */
  static async applyOptimizedConfiguration() {
    try {
      const optimizedConfig = this.getOptimizedConfig();
      
      // Update sequelize configuration
      Object.assign(sequelize.config, optimizedConfig);
      
      logger.info('Applied optimized database configuration', {
        pool: optimizedConfig.pool,
        retry: optimizedConfig.retry
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to apply optimized configuration:', error);
      throw error;
    }
  }

  /**
   * MySQL configuration recommendations (for my.cnf or database admin)
   */
  static getMySQLConfigurationRecommendations() {
    return {
      // InnoDB settings for lock contention prevention
      innodb_buffer_pool_size: '1G', // Adjust based on available RAM
      innodb_log_file_size: '256M',
      innodb_log_buffer_size: '64M',
      innodb_flush_log_at_trx_commit: 2, // Balanced durability/performance
      innodb_lock_wait_timeout: 30, // Increased from default 50 to 30 seconds
      
      // Connection settings
      max_connections: 200,
      thread_cache_size: 16,
      table_open_cache: 4000,
      
      // Query cache (if using MySQL 5.7 or earlier)
      query_cache_type: 1,
      query_cache_size: '128M',
      query_cache_limit: '2M',
      
      // Transaction isolation
      transaction_isolation: 'READ-COMMITTED',
      
      // Binary logging for recovery
      log_bin: 'mysql-bin',
      binlog_format: 'ROW',
      expire_logs_days: 7,
      
      // Error logging
      log_error: '/var/log/mysql/error.log',
      slow_query_log: 1,
      long_query_time: 2,
      slow_query_log_file: '/var/log/mysql/slow.log'
    };
  }

  /**
   * Health check for database performance
   */
  static async performHealthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      connection: null,
      performance: null,
      locks: null,
      configuration: null
    };

    try {
      // Test connection
      await sequelize.authenticate();
      health.connection = { status: 'healthy', message: 'Connection successful' };

      // Get performance metrics
      const [connectionStats] = await sequelize.query(`
        SHOW STATUS LIKE 'Threads%'
      `);
      
      const [innodbStats] = await sequelize.query(`
        SHOW STATUS LIKE 'Innodb_buffer_pool%'
      `);

      health.performance = {
        threads: connectionStats,
        innodb: innodbStats
      };

      // Check for active locks
      const [lockWaits] = await sequelize.query(`
        SELECT COUNT(*) as wait_count 
        FROM INFORMATION_SCHEMA.INNODB_LOCK_WAITS
      `);

      health.locks = {
        activeWaits: lockWaits[0].wait_count,
        status: lockWaits[0].wait_count > 0 ? 'WARNING' : 'HEALTHY'
      };

      // Configuration check
      health.configuration = {
        current: {
          pool_max: sequelize.config.pool?.max || 'unknown',
          pool_min: sequelize.config.pool?.min || 'unknown'
        },
        recommended: this.getOptimizedConfig()
      };

      return health;
    } catch (error) {
      health.connection = { 
        status: 'unhealthy', 
        error: error.message 
      };
      
      logger.error('Database health check failed:', error);
      return health;
    }
  }

  /**
   * Execute optimized query with retry logic
   */
  static async executeOptimizedQuery(query, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      lockTimeoutMs = 30000,
      ...queryOptions
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        // Add timeout to query
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), lockTimeoutMs);
        });
        
        const queryPromise = sequelize.query(query, queryOptions);
        
        const result = await Promise.race([queryPromise, timeoutPromise]);
        const duration = Date.now() - startTime;

        // Log slow queries
        if (duration > 1000) {
          logger.warn(`SLOW QUERY DETECTED (${duration}ms):`, {
            query: query.substring(0, 100) + '...',
            duration,
            attempt
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        
        // Check if it's a lock-related error
        const isLockError = error.message.includes('Lock wait timeout') ||
                           error.message.includes('Deadlock') ||
                           error.code === 'ER_LOCK_DEADLOCK' ||
                           error.code === 'ER_LOCK_WAIT_TIMEOUT';

        if (!isLockError || attempt === maxRetries) {
          // Not a lock error or max retries reached
          throw error;
        }

        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1);
        logger.warn(`Query attempt ${attempt} failed with lock error, retrying in ${delay}ms:`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Monitor database connection pool health
   */
  static startPoolMonitoring(intervalMs = 30000) {
    logger.info('Starting database pool monitoring');
    
    this.poolMonitoringInterval = setInterval(async () => {
      try {
        const pool = sequelize.connectionManager.pool;
        
        if (pool) {
          const poolStatus = {
            total: pool.total || 0,
            idle: pool.idle || 0,
            waiting: pool.waiting || 0,
            active: pool.borrowed || 0
          };
          
          // Alert if pool is under stress
          if (poolStatus.waiting > 5 || poolStatus.active >= sequelize.config.pool.max - 1) {
            logger.warn('Database pool under stress:', poolStatus);
          }
          
          logger.debug('Pool status:', poolStatus);
        }
      } catch (error) {
        logger.warn('Pool monitoring error:', error.message);
      }
    }, intervalMs);
  }

  /**
   * Stop pool monitoring
   */
  static stopPoolMonitoring() {
    if (this.poolMonitoringInterval) {
      clearInterval(this.poolMonitoringInterval);
      logger.info('Stopped database pool monitoring');
    }
  }

  /**
   * Generate configuration report
   */
  static async generateConfigurationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      current: {
        sequelize: {
          pool: sequelize.config.pool,
          dialect: sequelize.config.dialect,
          host: sequelize.config.host
        }
      },
      recommendations: {
        mysql_config: this.getMySQLConfigurationRecommendations(),
        sequelize_config: this.getOptimizedConfig()
      },
      health_check: await this.performHealthCheck(),
      implementation_steps: [
        '1. Update database configuration files',
        '2. Apply sequelize configuration changes',
        '3. Monitor performance metrics',
        '4. Adjust pool sizes based on load',
        '5. Set up alerting for lock timeouts'
      ]
    };

    return report;
  }
}

module.exports = DatabaseOptimization;