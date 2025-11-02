/**
 * MySQL Lock Contention Analyzer
 * Diagnostic tool to identify lock timeout sources during password updates
 * 
 * Usage: node diagnostics/lock-contention-analyzer.js
 */

const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const PerformanceMonitor = require('./performance-monitor');

class LockContentionAnalyzer {
  constructor() {
    this.monitor = new PerformanceMonitor();
    this.originalSequelizeQuery = sequelize.query.bind(sequelize);
    this.setupQueryMonitoring();
  }

  /**
   * Setup comprehensive query monitoring to track lock contention
   */
  setupQueryMonitoring() {
    // Monitor all database queries for lock contention
    sequelize.beforeFind((options) => {
      this.logQuery('BEFORE_FIND', options);
    });

    sequelize.beforeUpdate((options) => {
      this.logQuery('BEFORE_UPDATE', options);
    });

    sequelize.beforeCreate((options) => {
      this.logQuery('BEFORE_CREATE', options);
    });

    sequelize.afterQuery((options, query) => {
      this.logQuery('AFTER_QUERY', { options, query });
    });
  }

  /**
   * Log database queries with lock-related information
   */
  logQuery(stage, data) {
    const timestamp = new Date().toISOString();
    const stackTrace = new Error().stack.split('\n')[2]; // Get caller info
    
    logger.info(`[LOCK_ANALYZER] ${stage} - ${timestamp}`, {
      query: data.options?.sql || data.query?.sql || 'Unknown',
      table: this.extractTableName(data),
      lockInfo: this.getLockInfo(data),
      caller: stackTrace.trim(),
      transactionId: data.transaction?.id || 'no-transaction',
      duration: data.duration || 0
    });
  }

  /**
   * Extract table name from query options
   */
  extractTableName(data) {
    if (data.options?.model) {
      return data.options.model.tableName || 'unknown';
    }
    if (data.options?.table) {
      return data.options.table;
    }
    if (data.query?.sql) {
      const match = data.query.sql.match(/FROM\s+(\w+)/i);
      return match ? match[1] : 'unknown';
    }
    return 'unknown';
  }

  /**
   * Get lock-related information from query data
   */
  getLockInfo(data) {
    const lockInfo = {
      hasTransaction: !!data.transaction,
      isolationLevel: data.transaction?.options?.isolationLevel,
      lockType: data.options?.lock || 'no-lock'
    };

    // Check for permission-related queries
    const query = data.options?.sql || data.query?.sql || '';
    if (query.includes('permission') || 
        query.includes('user_roles') || 
        query.includes('permission_users') ||
        query.includes('permission_roles')) {
      lockInfo.queryType = 'PERMISSION_CHECK';
      lockInfo.suspectedLockContention = true;
    }

    // Check for user-related queries
    if (query.includes('users') && (query.includes('UPDATE') || query.includes('SELECT'))) {
      lockInfo.queryType = 'USER_OPERATION';
      if (query.includes('UPDATE')) {
        lockInfo.lockRisk = 'HIGH - UPDATE locks user row';
      }
    }

    return lockInfo;
  }

  /**
   * Check current database locks and transactions
   */
  async analyzeCurrentLocks() {
    try {
      const [lockResults] = await sequelize.query(`
        SELECT 
          PROCESSLIST_ID as thread_id,
          USER as user,
          HOST as host,
          DB as database,
          COMMAND as command,
          TIME as time_seconds,
          STATE as state,
          INFO as info
        FROM INFORMATION_SCHEMA.PROCESSLIST 
        WHERE DB = DATABASE() 
        AND COMMAND IN ('Sleep', 'Query')
        ORDER BY TIME DESC
      `);

      const [innodbLocks] = await sequelize.query(`
        SELECT 
          lock_id,
          lock_trx_id,
          lock_mode,
          lock_type,
          lock_table,
          lock_index,
          lock_page,
          lock_rec,
          lock_data
        FROM INFORMATION_SCHEMA.INNODB_LOCKS
      `);

      const [innodbLockWaits] = await sequelize.query(`
        SELECT 
          requesting_trx_id,
          requested_trx_id,
          blocking_trx_id,
          blocking_lock_id,
          wait_type,
          wait_start_time
        FROM INFORMATION_SCHEMA.INNODB_LOCK_WAITS
      `);

      logger.info('[LOCK_ANALYZER] Current database state:', {
        activeConnections: lockResults.length,
        activeLocks: innodbLocks.length,
        lockWaits: innodbLockWaits.length,
        details: {
          processes: lockResults,
          locks: innodbLocks,
          waits: innodbLockWaits
        }
      });

      return {
        activeConnections: lockResults,
        activeLocks: innodbLocks,
        lockWaits: innodbLockWaits
      };
    } catch (error) {
      logger.error('[LOCK_ANALYZER] Error analyzing locks:', error);
      return null;
    }
  }

  /**
   * Monitor password update operation for lock contention
   */
  async monitorPasswordUpdate(userId, operation = 'TEST_UPDATE') {
    const operationId = `password_update_${userId}_${Date.now()}`;
    
    logger.info(`[LOCK_ANALYZER] Starting monitoring for ${operationId}`);

    try {
      // Capture initial state
      const initialState = await this.analyzeCurrentLocks();
      
      const startTime = Date.now();
      
      // Monitor during the operation
      const monitoringInterval = setInterval(async () => {
        const currentState = await this.analyzeCurrentLocks();
        logger.info(`[LOCK_ANALYZER] Mid-operation check for ${operationId}`, {
          duration: Date.now() - startTime,
          state: currentState
        });
      }, 1000); // Check every second

      // Execute the monitored operation
      const result = await this.executeMonitoredOperation(operationId, userId, operation);
      
      clearInterval(monitoringInterval);
      
      // Capture final state
      const finalState = await this.analyzeCurrentLocks();
      
      const duration = Date.now() - startTime;
      
      logger.info(`[LOCK_ANALYZER] Operation ${operationId} completed`, {
        duration,
        result: 'SUCCESS',
        initialState,
        finalState,
        operation
      });

      return {
        operationId,
        duration,
        success: true,
        initialState,
        finalState,
        result
      };

    } catch (error) {
      logger.error(`[LOCK_ANALYZER] Operation ${operationId} failed:`, error);
      
      const finalState = await this.analyzeCurrentLocks();
      
      return {
        operationId,
        success: false,
        error: error.message,
        finalState
      };
    }
  }

  /**
   * Execute monitored database operation
   */
  async executeMonitoredOperation(operationId, userId, operation) {
    const { User } = require('../models');
    
    switch (operation) {
      case 'PERMISSION_CHECK':
        // Simulate permission check during password update
        const PermissionService = require('../services/permission.service');
        return await PermissionService.hasPermission(userId, 'change_own_password');
        
      case 'USER_FETCH':
        // Simulate user fetch
        return await User.findByPk(userId);
        
      case 'PASSWORD_UPDATE':
        // Simulate password update
        const user = await User.findByPk(userId);
        if (user) {
          user.password_changed_at = new Date();
          await user.save();
        }
        return user;
        
      case 'FULL_UPDATE_WORKFLOW':
        // Simulate the full password update workflow
        const UserModel = require('../models/user.model');
        const bcrypt = require('bcryptjs');
        
        const transaction = await User.sequelize.transaction();
        
        try {
          // Step 1: Fetch user with lock
          const user = await User.findByPk(userId, { 
            transaction,
            lock: transaction.LOCK.UPDATE 
          });
          
          // Step 2: Check phone change status (additional query)
          const hasPendingChange = user.isPhoneChangePending();
          
          // Step 3: Update password
          if (!hasPendingChange) {
            user.password = await bcrypt.hash('test_password_123', 12);
            user.password_changed_at = new Date();
            await user.save({ transaction });
          }
          
          await transaction.commit();
          return user;
          
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Generate comprehensive lock contention report
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      database: {
        config: {
          pool: sequelize.config.pool,
          dialect: sequelize.config.dialect,
          host: sequelize.config.host,
          port: sequelize.config.port
        },
        currentLocks: await this.analyzeCurrentLocks()
      },
      operations: [],
      recommendations: []
    };

    return report;
  }

  /**
   * Start continuous monitoring
   */
  startContinuousMonitoring(intervalMs = 5000) {
    logger.info('[LOCK_ANALYZER] Starting continuous monitoring');
    
    this.monitoringTimer = setInterval(async () => {
      const state = await this.analyzeCurrentLocks();
      
      if (state?.lockWaits?.length > 0) {
        logger.warn('[LOCK_ANALYZER] DETECTED LOCK WAITS:', state.lockWaits);
      }
      
      if (state?.activeConnections?.length > 10) {
        logger.warn('[LOCK_ANALYZER] HIGH CONNECTION COUNT:', state.activeConnections.length);
      }
    }, intervalMs);
  }

  /**
   * Stop continuous monitoring
   */
  stopContinuousMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      logger.info('[LOCK_ANALYZER] Continuous monitoring stopped');
    }
  }
}

module.exports = LockContentionAnalyzer;