/**
 * Main Diagnostic Script
 * Executes lock contention analysis and generates comprehensive report
 * 
 * Usage: node diagnostics/run-diagnosis.js [test-type]
 * test-type: 'quick' | 'full' | 'performance'
 */

const LockContentionTest = require('../test/lock-contention-test');
const LockContentionAnalyzer = require('./lock-contention-analyzer');
const PerformanceMonitor = require('./performance-monitor');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class DiagnosisRunner {
  constructor() {
    this.test = new LockContentionTest();
    this.analyzer = new LockContentionAnalyzer();
    this.monitor = new PerformanceMonitor();
  }

  /**
   * Run quick diagnostic test
   */
  async runQuickDiagnostic() {
    logger.info('=== QUICK DIAGNOSTIC STARTING ===');
    
    try {
      const result = await this.test.quickDiagnostic();
      
      console.log('\n🚨 QUICK DIAGNOSTIC RESULTS:');
      console.log('=====================================');
      console.log(`✅ Success: ${result.success}`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`⚠️  Lock Contention: ${result.lockContentionDetected ? 'DETECTED' : 'None'}`);
      console.log(`🎯 Action Required: ${result.immediateAction}`);
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      logger.error('Quick diagnostic failed:', error);
      console.log('❌ Quick diagnostic failed:', error.message);
      return null;
    }
  }

  /**
   * Run comprehensive diagnostic tests
   */
  async runFullDiagnostic() {
    logger.info('=== COMPREHENSIVE DIAGNOSTIC STARTING ===');
    
    try {
      console.log('\n🔍 Running comprehensive lock contention analysis...');
      console.log('This may take 2-3 minutes...\n');
      
      const report = await this.test.runAllTests();
      
      this.displayReport(report);
      await this.saveReport(report, 'full-diagnostic-report.json');
      
      return report;
    } catch (error) {
      logger.error('Full diagnostic failed:', error);
      console.log('❌ Full diagnostic failed:', error.message);
      return null;
    }
  }

  /**
   * Run performance analysis
   */
  async runPerformanceAnalysis() {
    logger.info('=== PERFORMANCE ANALYSIS STARTING ===');
    
    try {
      console.log('\n⚡ Running performance analysis...');
      console.log('This may take 1-2 minutes...\n');
      
      // Start continuous monitoring
      this.analyzer.startContinuousMonitoring(2000); // Check every 2 seconds
      
      // Run a few iterations of password updates
      await this.test.setup();
      
      const iterations = 10;
      console.log(`Running ${iterations} password update operations...`);
      
      for (let i = 1; i <= iterations; i++) {
        console.log(`Iteration ${i}/${iterations}...`);
        await this.analyzer.monitorPasswordUpdate(
          this.test.testUser.id,
          'FULL_UPDATE_WORKFLOW'
        );
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await this.test.cleanup();
      
      // Stop monitoring
      this.analyzer.stopContinuousMonitoring();
      
      // Generate and display performance report
      const performanceReport = this.monitor.getSummary();
      const slowQueries = this.monitor.getSlowQueryReport(10);
      
      console.log('\n📊 PERFORMANCE ANALYSIS RESULTS:');
      console.log('=====================================');
      console.log(`🕐 Time Period: ${performanceReport.timeframe}`);
      console.log(`📈 Total Queries: ${performanceReport.queries.total}`);
      console.log(`🐌 Slow Queries (>${this.monitor.thresholds.slowQuery}ms): ${performanceReport.queries.slow}`);
      console.log(`❌ Failed Queries: ${performanceReport.queries.failed}`);
      console.log(`⚡ Avg Query Time: ${performanceReport.queries.averageDuration}ms`);
      console.log(`🔐 Permission Queries: ${performanceReport.queries.permissionQueries}`);
      console.log(`💼 Transactions: ${performanceReport.transactions.total}`);
      console.log(`⏱️  Avg Transaction Time: ${performanceReport.transactions.averageDuration}ms`);
      
      if (slowQueries.length > 0) {
        console.log('\n🐌 SLOWEST QUERIES:');
        slowQueries.forEach((query, index) => {
          console.log(`${index + 1}. ${query.duration}ms - ${query.sql.substring(0, 80)}...`);
        });
      }
      
      const report = {
        timestamp: new Date().toISOString(),
        performanceReport,
        slowQueries,
        metrics: this.monitor.exportMetrics()
      };
      
      await this.saveReport(report, 'performance-analysis-report.json');
      
      return report;
    } catch (error) {
      logger.error('Performance analysis failed:', error);
      console.log('❌ Performance analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Display comprehensive diagnostic report
   */
  displayReport(report) {
    console.log('\n📋 COMPREHENSIVE DIAGNOSTIC REPORT');
    console.log('=====================================');
    console.log(`📅 Generated: ${report.timestamp}`);
    
    console.log('\n🧪 TEST RESULTS:');
    report.testResults.forEach((test, index) => {
      const status = test.success ? '✅' : '❌';
      const duration = test.duration ? ` (${test.duration}ms)` : '';
      console.log(`${index + 1}. ${status} ${test.testName}${duration}`);
      
      if (!test.success && test.error) {
        console.log(`   Error: ${test.error}`);
      }
      
      if (test.failed !== undefined) {
        console.log(`   Successful: ${test.successful}, Failed: ${test.failed}`);
      }
    });
    
    console.log('\n⚡ PERFORMANCE SUMMARY:');
    const perf = report.performanceSummary;
    console.log(`🕐 Period: ${perf.timeframe}`);
    console.log(`📊 Queries: ${perf.queries.total} (${perf.queries.slow} slow, ${perf.queries.failed} failed)`);
    console.log(`⚡ Avg Query: ${perf.queries.averageDuration}ms`);
    console.log(`🔐 Permission Queries: ${perf.queries.permissionQueries}`);
    console.log(`💼 Transactions: ${perf.transactions.total} (${perf.transactions.averageDuration}ms avg)`);
    
    if (report.diagnosis && report.diagnosis.length > 0) {
      console.log('\n🔍 DIAGNOSIS:');
      report.diagnosis.forEach(diag => {
        const emoji = diag.level === 'CRITICAL' ? '🚨' : diag.level === 'HIGH' ? '⚠️' : '💡';
        console.log(`${emoji} ${diag.level}: ${diag.issue}`);
        if (diag.affectedTests) {
          console.log(`   Affected: ${diag.affectedTests.join(', ')}`);
        }
      });
    }
    
    if (report.recommendations && report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        const priority = rec.priority === 'CRITICAL' ? '🚨' : rec.priority === 'HIGH' ? '⚠️' : '💭';
        console.log(`${index + 1}. ${priority} ${rec.title} (${rec.priority})`);
        console.log(`   ${rec.description}`);
        console.log(`   Implementation: ${rec.implementation}`);
        console.log(`   Impact: ${rec.impact} | Effort: ${rec.effort}\n`);
      });
    }
  }

  /**
   * Save report to file
   */
  async saveReport(report, filename) {
    try {
      const reportsDir = path.join(__dirname, '../reports');
      
      // Ensure reports directory exists
      try {
        await fs.access(reportsDir);
      } catch {
        await fs.mkdir(reportsDir, { recursive: true });
      }
      
      const filepath = path.join(reportsDir, filename);
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      
      console.log(`📁 Report saved: ${filepath}`);
    } catch (error) {
      logger.error('Failed to save report:', error);
    }
  }

  /**
   * Main diagnostic runner
   */
  async run(testType = 'quick') {
    console.log('🚀 MySQL Lock Contention Diagnostic Tool');
    console.log('=========================================\n');
    
    let result;
    
    switch (testType.toLowerCase()) {
      case 'full':
        result = await this.runFullDiagnostic();
        break;
        
      case 'performance':
        result = await this.runPerformanceAnalysis();
        break;
        
      case 'quick':
      default:
        result = await this.runQuickDiagnostic();
        break;
    }
    
    console.log('\n✅ Diagnostic completed!');
    
    return result;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const testType = args[0] || 'quick';
  
  const runner = new DiagnosisRunner();
  
  runner.run(testType)
    .then(result => {
      process.exit(result ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = DiagnosisRunner;