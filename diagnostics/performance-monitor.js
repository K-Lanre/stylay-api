/**
 * Performance Monitor for Database Operations
 * Tracks query execution times and identifies slow operations that could cause lock timeouts
 */

const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      queries: [],
      slowQueries: [],
      transactionMetrics: [],
      lockWaits: []
    };
    
    this.thresholds = {
      slowQuery: 1000, // 1 second
      verySlowQuery: 3000, // 3 seconds
      lockWaitThreshold: 5000 // 5 seconds
    };

    this.setupMonitoring();
  }

  /**
   * Setup performance monitoring hooks
   */
  setupMonitoring() {
    // Monitor query execution
    const originalQuery = sequelize.query.bind(sequelize);
    
    sequelize.query = async (sql, options = {}) => {
      const startTime = Date.now();
      const queryId = this.generateQueryId();
      
      try {
        const result = await originalQuery(sql, options);
        const duration = Date.now() - startTime;
        
        this.recordQuery({
          id: queryId,
          sql: this.sanitizeSql(sql),
          duration,
          success: true,
          options,
          timestamp: new Date().toISOString()
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.recordQuery({
          id: queryId,
          sql: this.sanitizeSql(sql),
          duration,
          success: false,
          error: error.message,
          options,
          timestamp: new Date().toISOString()
        });
        
        throw error;
      }
    };

    // Monitor transaction events
    this.setupTransactionMonitoring();
  }

  /**
   * Setup transaction-level monitoring
   */
  setupTransactionMonitoring() {
    // Track when transactions are created and committed/rolled back
    const originalTransaction = sequelize.transaction.bind(sequelize);
    
    sequelize.transaction = async (options = {}) => {
      const transactionId = this.generateTransactionId();
      const startTime = Date.now();
      
      logger.info(`[PERF_MONITOR] Transaction ${transactionId} started`, {
        transactionId,
        isolationLevel: options.isolationLevel,
        timestamp: new Date().toISOString()
      });
      
      try {
        const transaction = await originalTransaction(options);
        
        // Wrap transaction methods to track usage
        const originalCommit = transaction.commit.bind(transaction);
        const originalRollback = transaction.rollback.bind(transaction);
        
        transaction.commit = async () => {
          const duration = Date.now() - startTime;
          logger.info(`[PERF_MONITOR] Transaction ${transactionId} committed`, {
            transactionId,
            duration,
            timestamp: new Date().toISOString()
          });
          
          this.recordTransaction({
            id: transactionId,
            duration,
            status: 'committed',
            operations: transaction.queryLog || []
          });
          
          return await originalCommit();
        };
        
        transaction.rollback = async () => {
          const duration = Date.now() - startTime;
          logger.warn(`[PERF_MONITOR] Transaction ${transactionId} rolled back`, {
            transactionId,
            duration,
            timestamp: new Date().toISOString()
          });
          
          this.recordTransaction({
            id: transactionId,
            duration,
            status: 'rolled_back',
            operations: transaction.queryLog || []
          });
          
          return await originalRollback();
        };
        
        return transaction;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        this.recordTransaction({
          id: transactionId,
          duration,
          status: 'failed',
          error: error.message,
          operations: []
        });
        
        throw error;
      }
    };
  }

  /**
   * Record query execution metrics
   */
  recordQuery(queryInfo) {
    this.metrics.queries.push(queryInfo);
    
    // Keep only last 1000 queries in memory
    if (this.metrics.queries.length > 1000) {
      this.metrics.queries.shift();
    }
    
    // Identify slow queries
    if (queryInfo.duration > this.thresholds.slowQuery) {
      this.metrics.slowQueries.push(queryInfo);
      
      // Log slow queries immediately if very slow
      if (queryInfo.duration > this.thresholds.verySlowQuery) {
        logger.warn('[PERF_MONITOR] Very slow query detected:', queryInfo);
      }
    }
    
    // Check for permission-related queries
    if (this.isPermissionQuery(queryInfo.sql)) {
      logger.info('[PERF_MONITOR] Permission query executed:', {
        duration: queryInfo.duration,
        sql: queryInfo.sql,
        slow: queryInfo.duration > this.thresholds.slowQuery
      });
    }
  }

  /**
   * Record transaction metrics
   */
  recordTransaction(transactionInfo) {
    this.metrics.transactionMetrics.push(transactionInfo);
    
    // Keep only last 100 transactions in memory
    if (this.metrics.transactionMetrics.length > 100) {
      this.metrics.transactionMetrics.shift();
    }
    
    // Alert on long transactions
    if (transactionInfo.duration > this.thresholds.lockWaitThreshold) {
      logger.warn('[PERF_MONITOR] Long-running transaction detected:', transactionInfo);
    }
  }

  /**
   * Check if query is permission-related
   */
  isPermissionQuery(sql) {
    const permissionKeywords = [
      'permission_users',
      'permission_roles', 
      'permission_user',
      'permission_role',
      'user_roles',
      'roles'
    ];
    
    return permissionKeywords.some(keyword => 
      sql.toLowerCase().includes(keyword)
    );
  }

  /**
   * Sanitize SQL for logging (remove sensitive data)
   */
  sanitizeSql(sql) {
    if (!sql) return '';
    
    // Remove potential password values
    let sanitized = sql.replace(/password['"\s]*=[^,\s)]+/gi, 'password=***');
    sanitized = sanitized.replace(/['"][^'"]*password[^'"]*['"]/gi, '"***password***"');
    
    // Limit length for logging
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200) + '...';
    }
    
    return sanitized;
  }

  /**
   * Generate unique query ID
   */
  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentQueries = this.metrics.queries.filter(q => 
      new Date(q.timestamp).getTime() > oneHourAgo
    );
    
    const recentTransactions = this.metrics.transactionMetrics.filter(t =>
      new Date(t.timestamp).getTime() > oneHourAgo
    );
    
    const avgQueryTime = recentQueries.length > 0 
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length
      : 0;
    
    const slowQueryCount = recentQueries.filter(q => 
      q.duration > this.thresholds.slowQuery
    ).length;
    
    const failedQueries = recentQueries.filter(q => !q.success).length;
    
    return {
      timeframe: 'Last hour',
      timestamp: new Date().toISOString(),
      queries: {
        total: recentQueries.length,
        slow: slowQueryCount,
        failed: failedQueries,
        averageDuration: Math.round(avgQueryTime),
        permissionQueries: recentQueries.filter(q => this.isPermissionQuery(q.sql)).length
      },
      transactions: {
        total: recentTransactions.length,
        committed: recentTransactions.filter(t => t.status === 'committed').length,
        rolledBack: recentTransactions.filter(t => t.status === 'rolled_back').length,
        failed: recentTransactions.filter(t => t.status === 'failed').length,
        averageDuration: recentTransactions.length > 0
          ? Math.round(recentTransactions.reduce((sum, t) => sum + t.duration, 0) / recentTransactions.length)
          : 0
      },
      thresholds: this.thresholds
    };
  }

  /**
   * Get detailed slow query report
   */
  getSlowQueryReport(limit = 10) {
    return this.metrics.slowQueries
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(query => ({
        duration: query.duration,
        sql: query.sql,
        timestamp: query.timestamp,
        success: query.success,
        isPermissionQuery: this.isPermissionQuery(query.sql)
      }));
  }

  /**
   * Get transaction performance report
   */
  getTransactionReport(limit = 10) {
    return this.metrics.transactionMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(transaction => ({
        duration: transaction.duration,
        status: transaction.status,
        timestamp: transaction.timestamp,
        error: transaction.error
      }));
  }

  /**
   * Analyze specific operation performance
   */
  async analyzeOperation(operationName, operationFunction) {
    const startTime = Date.now();
    const operationId = this.generateQueryId();
    
    logger.info(`[PERF_MONITOR] Starting operation analysis: ${operationName}`, {
      operationId,
      timestamp: new Date().toISOString()
    });
    
    try {
      const result = await operationFunction();
      const duration = Date.now() - startTime;
      
      logger.info(`[PERF_MONITOR] Operation completed: ${operationName}`, {
        operationId,
        duration,
        success: true,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        duration,
        result,
        operationId
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`[PERF_MONITOR] Operation failed: ${operationName}`, {
        operationId,
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        duration,
        error: error.message,
        operationId
      };
    }
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      queries: [],
      slowQueries: [],
      transactionMetrics: [],
      lockWaits: []
    };
    
    logger.info('[PERF_MONITOR] All metrics reset');
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      ...this.metrics,
      summary: this.getSummary(),
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = PerformanceMonitor;