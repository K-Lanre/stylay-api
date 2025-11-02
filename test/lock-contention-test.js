/**
 * Lock Contention Test Suite
 * Tests the MySQL lock timeout scenarios during password updates
 * 
 * This test simulates concurrent access patterns that cause lock timeouts
 * and validates the effectiveness of proposed solutions.
 */

const LockContentionAnalyzer = require('../diagnostics/lock-contention-analyzer');
const PerformanceMonitor = require('../diagnostics/performance-monitor');
const { sequelize } = require('../config/database');
const { User, Permission, Role } = require('../models');
const PermissionService = require('../services/permission.service');
const logger = require('../utils/logger');

class LockContentionTest {
  constructor() {
    this.analyzer = new LockContentionAnalyzer();
    this.monitor = new PerformanceMonitor();
    this.testUser = null;
    this.testResults = [];
  }

  /**
   * Setup test environment
   */
  async setup() {
    logger.info('[LOCK_TEST] Setting up test environment');
    
    try {
      // Create test user
      this.testUser = await User.create({
        first_name: 'Test',
        last_name: 'User',
        email: `test_${Date.now()}@example.com`,
        password: 'testpassword123',
        phone: `+23480123456${Math.floor(Math.random() * 100)}`,
        is_active: true
      });

      // Ensure test user has necessary role and permissions
      const customerRole = await Role.findOne({ where: { name: 'customer' } });
      if (customerRole) {
        await this.testUser.addRole(customerRole);
      }

      logger.info(`[LOCK_TEST] Test user created: ${this.testUser.id}`);
    } catch (error) {
      logger.error('[LOCK_TEST] Setup failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    logger.info('[LOCK_TEST] Cleaning up test environment');
    
    try {
      if (this.testUser) {
        await this.testUser.destroy();
        logger.info('[LOCK_TEST] Test user cleaned up');
      }
    } catch (error) {
      logger.error('[LOCK_TEST] Cleanup failed:', error);
    }
  }

  /**
   * Test 1: Permission Service Lock Contention
   * This test demonstrates the primary source of lock contention
   */
  async testPermissionServiceLockContention() {
    logger.info('[LOCK_TEST] Test 1: Permission Service Lock Contention');
    
    const testName = 'Permission Service Lock Contention';
    const userId = this.testUser.id;
    
    try {
      // Monitor the permission service calls
      const result = await this.analyzer.monitorPasswordUpdate(
        userId, 
        'PERMISSION_CHECK'
      );
      
      this.testResults.push({
        testName,
        success: result.success,
        duration: result.duration,
        details: result
      });

      logger.info(`[LOCK_TEST] ${testName} completed`, {
        success: result.success,
        duration: result.duration
      });

      return result;
    } catch (error) {
      logger.error(`[LOCK_TEST] ${testName} failed:`, error);
      this.testResults.push({
        testName,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 2: Concurrent Password Updates
   * This test simulates multiple concurrent password updates
   */
  async testConcurrentPasswordUpdates() {
    logger.info('[LOCK_TEST] Test 2: Concurrent Password Updates');
    
    const testName = 'Concurrent Password Updates';
    const userId = this.testUser.id;
    
    try {
      // Create multiple concurrent operations
      const operations = [];
      
      for (let i = 0; i < 5; i++) {
        operations.push(
          this.analyzer.monitorPasswordUpdate(userId, 'PASSWORD_UPDATE')
        );
      }
      
      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      this.testResults.push({
        testName,
        success: failed === 0,
        total: operations.length,
        successful,
        failed,
        results: results.map((r, i) => ({
          operationIndex: i,
          status: r.status,
          result: r.status === 'fulfilled' ? r.value : r.reason.message
        }))
      });

      logger.info(`[LOCK_TEST] ${testName} completed`, {
        total: operations.length,
        successful,
        failed
      });

      return { successful, failed, results };
    } catch (error) {
      logger.error(`[LOCK_TEST] ${testName} failed:`, error);
      this.testResults.push({
        testName,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 3: Full Password Update Workflow
   * This test simulates the complete password update process
   */
  async testFullPasswordUpdateWorkflow() {
    logger.info('[LOCK_TEST] Test 3: Full Password Update Workflow');
    
    const testName = 'Full Password Update Workflow';
    const userId = this.testUser.id;
    
    try {
      // Test the full workflow that includes permission checks and user updates
      const result = await this.analyzer.monitorPasswordUpdate(
        userId,
        'FULL_UPDATE_WORKFLOW'
      );
      
      this.testResults.push({
        testName,
        success: result.success,
        duration: result.duration,
        details: result
      });

      logger.info(`[LOCK_TEST] ${testName} completed`, {
        success: result.success,
        duration: result.duration
      });

      return result;
    } catch (error) {
      logger.error(`[LOCK_TEST] ${testName} failed:`, error);
      this.testResults.push({
        testName,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 4: Permission Cache Effectiveness
   * Test the effectiveness of permission caching
   */
  async testPermissionCacheEffectiveness() {
    logger.info('[LOCK_TEST] Test 4: Permission Cache Effectiveness');
    
    const testName = 'Permission Cache Effectiveness';
    const userId = this.testUser.id;
    
    try {
      // Test multiple permission checks without cache
      const uncachedChecks = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await PermissionService.hasPermission(userId, 'change_own_password');
        uncachedChecks.push(Date.now() - start);
      }
      
      // Test multiple permission checks with simulated cache
      const cachedChecks = [];
      const cachedPermission = await PermissionService.getUserPermissions(userId);
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        // Simulate cache hit by checking if permission exists in cached array
        cachedPermission.some(p => p.name === 'change_own_password');
        cachedChecks.push(Date.now() - start);
      }
      
      const avgUncached = uncachedChecks.reduce((a, b) => a + b) / uncachedChecks.length;
      const avgCached = cachedChecks.reduce((a, b) => a + b) / cachedChecks.length;
      
      const improvement = ((avgUncached - avgCached) / avgUncached * 100).toFixed(2);
      
      this.testResults.push({
        testName,
        success: true,
        metrics: {
          avgUncached,
          avgCached,
          improvement: `${improvement}%`,
          uncachedChecks,
          cachedChecks
        }
      });

      logger.info(`[LOCK_TEST] ${testName} completed`, {
        avgUncached: `${avgUncached.toFixed(2)}ms`,
        avgCached: `${avgCached.toFixed(2)}ms`,
        improvement: `${improvement}%`
      });

      return { avgUncached, avgCached, improvement };
    } catch (error) {
      logger.error(`[LOCK_TEST] ${testName} failed:`, error);
      this.testResults.push({
        testName,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 5: Database Connection Pool Pressure
   * Test behavior under connection pool pressure
   */
  async testConnectionPoolPressure() {
    logger.info('[LOCK_TEST] Test 5: Database Connection Pool Pressure');
    
    const testName = 'Database Connection Pool Pressure';
    const userId = this.testUser.id;
    
    try {
      // Simulate high load with many concurrent operations
      const concurrentOperations = 20;
      const operations = [];
      
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(
          this.monitor.analyzeOperation(
            `pool_test_${i}`,
            async () => {
              // Mix of different operations
              if (i % 3 === 0) {
                return await PermissionService.hasPermission(userId, 'change_own_password');
              } else if (i % 3 === 1) {
                return await User.findByPk(userId);
              } else {
                const user = await User.findByPk(userId);
                if (user) {
                  user.updated_at = new Date();
                  await user.save();
                }
                return user;
              }
            }
          )
        );
      }
      
      const results = await Promise.allSettled(operations);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      this.testResults.push({
        testName,
        success: failed === 0,
        total: concurrentOperations,
        successful,
        failed,
        poolMetrics: {
          max: sequelize.config.pool.max,
          min: sequelize.config.pool.min,
          acquire: sequelize.config.pool.acquire,
          idle: sequelize.config.pool.idle
        }
      });

      logger.info(`[LOCK_TEST] ${testName} completed`, {
        total: concurrentOperations,
        successful,
        failed
      });

      return { successful, failed };
    } catch (error) {
      logger.error(`[LOCK_TEST] ${testName} failed:`, error);
      this.testResults.push({
        testName,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    logger.info('[LOCK_TEST] Starting comprehensive lock contention tests');
    
    try {
      await this.setup();
      
      await this.testPermissionServiceLockContention();
      await this.testConcurrentPasswordUpdates();
      await this.testFullPasswordUpdateWorkflow();
      await this.testPermissionCacheEffectiveness();
      await this.testConnectionPoolPressure();
      
      // Generate final report
      const report = await this.generateTestReport();
      
      await this.cleanup();
      
      return report;
    } catch (error) {
      logger.error('[LOCK_TEST] Test suite failed:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport() {
    const performanceSummary = this.monitor.getSummary();
    const slowQueries = this.monitor.getSlowQueryReport(5);
    
    const report = {
      timestamp: new Date().toISOString(),
      testResults: this.testResults,
      performanceSummary,
      slowQueries,
      databaseConfiguration: {
        pool: sequelize.config.pool,
        dialect: sequelize.config.dialect
      },
      diagnosis: this.generateDiagnosis(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate diagnosis based on test results
   */
  generateDiagnosis() {
    const failedTests = this.testResults.filter(t => !t.success);
    const slowTests = this.testResults.filter(t => t.duration && t.duration > 2000);
    
    let diagnosis = [];
    
    if (failedTests.length > 0) {
      diagnosis.push({
        level: 'CRITICAL',
        issue: 'Tests are failing, indicating system instability',
        affectedTests: failedTests.map(t => t.testName)
      });
    }
    
    if (slowTests.length > 0) {
      diagnosis.push({
        level: 'WARNING',
        issue: 'Long-running operations detected',
        affectedTests: slowTests.map(t => t.testName),
        maxDuration: Math.max(...slowTests.map(t => t.duration))
      });
    }
    
    // Analyze permission service impact
    const permissionTests = this.testResults.filter(t => 
      t.testName.includes('Permission') && t.duration
    );
    
    if (permissionTests.length > 0) {
      const avgPermissionDuration = permissionTests.reduce((sum, t) => sum + t.duration, 0) / permissionTests.length;
      
      if (avgPermissionDuration > 500) {
        diagnosis.push({
          level: 'HIGH',
          issue: 'Permission service is causing significant delays',
          averageDuration: avgPermissionDuration,
          impact: 'Primary cause of lock timeouts'
        });
      }
    }
    
    return diagnosis;
  }

  /**
   * Generate recommendations based on test results and diagnosis
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Check if permission service is the main issue
    const permissionTests = this.testResults.filter(t => 
      t.testName.includes('Permission') && t.duration && t.duration > 500
    );
    
    if (permissionTests.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Implement Permission Caching',
        description: 'Permission checks are causing significant delays. Implement Redis-based permission caching.',
        implementation: 'Add user permission cache with 5-minute TTL',
        effort: 'Medium',
        impact: 'High'
      });
      
      recommendations.push({
        priority: 'HIGH', 
        title: 'Optimize Permission Service Queries',
        description: 'Reduce the number of database calls in permission checks by using single optimized queries.',
        implementation: 'Rewrite PermissionService.getUserPermissions() to use JOIN queries',
        effort: 'Low',
        impact: 'High'
      });
    }
    
    // Check for concurrent update issues
    const concurrentTests = this.testResults.find(t => t.testName === 'Concurrent Password Updates');
    if (concurrentTests && concurrentTests.failed > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'Implement Row-Level Locking Strategy',
        description: 'Concurrent password updates are failing due to lock contention.',
        implementation: 'Use SELECT...FOR UPDATE with proper transaction management',
        effort: 'Medium',
        impact: 'High'
      });
    }
    
    // Database pool recommendations
    recommendations.push({
      priority: 'MEDIUM',
      title: 'Increase Database Connection Pool',
      description: 'Current pool size may be insufficient for concurrent operations.',
      implementation: 'Increase max connections to 10-15 and optimize acquire timeout',
      effort: 'Low',
      impact: 'Medium'
    });
    
    return recommendations;
  }

  /**
   * Quick diagnostic test
   */
  async quickDiagnostic() {
    logger.info('[LOCK_TEST] Running quick diagnostic');
    
    try {
      await this.setup();
      
      const result = await this.analyzer.monitorPasswordUpdate(
        this.testUser.id,
        'FULL_UPDATE_WORKFLOW'
      );
      
      await this.cleanup();
      
      return {
        success: result.success,
        duration: result.duration,
        lockContentionDetected: !result.success || result.duration > 3000,
        immediateAction: result.duration > 3000 ? 'Optimize permission service queries' : 'Monitor for patterns'
      };
    } catch (error) {
      await this.cleanup();
      return {
        success: false,
        error: error.message,
        lockContentionDetected: true,
        immediateAction: 'Review database configuration and transaction management'
      };
    }
  }
}

module.exports = LockContentionTest;