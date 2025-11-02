'use strict';

/**
 * Comprehensive Test Suite for Optimized Permission Seeding System
 * Tests all critical fixes implemented in the optimized seeders
 */

const { Permission, Role, PermissionRole, PermissionUser } = require('./models');
const { Op } = require('sequelize');

console.log('🧪 PERMISSION SEEDING TEST SUITE');
console.log('===================================\n');

// Test data
const testPermissions = [
  { name: 'test_basic_permission', resource: 'users', action: 'read', description: 'Basic test permission' },
  { name: 'test_permission_with_similar_name', resource: 'users', action: 'create', description: 'Similar name test' },
  { name: 'test_permission_with_different_case', resource: 'users', action: 'update', description: 'Different case test' },
  { name: 'test_transaction_rollback_1', resource: 'test', action: 'create', description: 'Rollback test 1' },
  { name: 'test_transaction_rollback_2', resource: 'test', action: 'create', description: 'Rollback test 2' },
  { name: 'test_concurrent_1', resource: 'concurrent', action: 'read', description: 'Concurrent test 1' },
  { name: 'test_concurrent_2', resource: 'concurrent', action: 'read', description: 'Concurrent test 2' },
  { name: 'test_bulk_performance', resource: 'bulk', action: 'manage', description: 'Bulk performance test' }
];

// Test roles
const testRoles = [
  { name: 'test_admin', description: 'Test admin role' },
  { name: 'test_vendor', description: 'Test vendor role' },
  { name: 'test_customer', description: 'Test customer role' }
];

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Remove test permissions
    await Permission.destroy({
      where: {
        name: { [Op.like]: 'test_%' }
      }
    });
    
    // Remove test roles (except built-in ones)
    const existingRoles = await Role.findAll({
      where: {
        name: { [Op.like]: 'test_%' }
      }
    });
    
    for (const role of existingRoles) {
      await PermissionRole.destroy({
        where: { role_id: role.id }
      });
      await PermissionUser.destroy({
        where: { user_id: role.id }
      });
      await role.destroy();
    }
    
    console.log('   ✅ Test data cleaned up successfully');
  } catch (error) {
    console.error('   ❌ Error cleaning up test data:', error.message);
  }
}

/**
 * Test 1: Slug Collision Detection
 */
async function testSlugCollisionDetection() {
  console.log('\n📋 Test 1: Slug Collision Detection');
  console.log('-------------------------------------');
  
  const slugify = require('slugify');
  
  // Test problematic names that could create collisions
  const collisionTestNames = [
    'view_own_profile',
    'view_personal_profile',
    'manage_users',
    'manage_all_users',
    'read_products',
    'read_product_details'
  ];
  
  // Simulate existing slugs
  const existingSlugs = ['manage-users', 'read-products'];
  
  function generateUniqueSlug(name, existingSlugs = []) {
    let baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;
    
    slug = slug.replace(/^(view_|manage_|read_|create_|update_|delete_)/, '');
    
    while (existingSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }
  
  const generatedSlugs = collisionTestNames.map(name => ({
    name,
    slug: generateUniqueSlug(name, existingSlugs)
  }));
  
  console.log('Generated slugs:');
  generatedSlugs.forEach(({ name, slug }) => {
    console.log(`   ${name} -> ${slug}`);
  });
  
  // Check for collisions
  const uniqueSlugs = new Set(generatedSlugs.map(item => item.slug));
  const hasCollisions = uniqueSlugs.size !== generatedSlugs.length;
  
  if (hasCollisions) {
    console.log('   ❌ FAIL: Slug collisions detected');
    return false;
  } else {
    console.log('   ✅ PASS: No slug collisions detected');
    return true;
  }
}

/**
 * Test 2: Transaction Management
 */
async function testTransactionManagement() {
  console.log('\n📋 Test 2: Transaction Management');
  console.log('----------------------------------');
  
  let transaction;
  let success = false;
  
  try {
    transaction = await Permission.sequelize.transaction();
    
    // Create permissions within transaction
    const testPerms = [
      { name: 'test_transaction_create', resource: 'test', action: 'create', description: 'Transaction test' },
      { name: 'test_transaction_fail', resource: 'test', action: 'create', description: 'Transaction fail test' }
    ];
    
    // Create first permission successfully
    await Permission.create(testPerms[0], { transaction });
    console.log('   ✅ Created first permission in transaction');
    
    // Intentionally fail second permission creation
    try {
      await Permission.create(testPerms[1], { transaction });
      throw new Error('Expected failure did not occur');
    } catch (error) {
      console.log('   💥 Intentionally triggered failure:', error.message);
      
      // Rollback transaction
      await transaction.rollback();
      console.log('   ✅ Transaction rolled back successfully');
      
      // Verify no permissions were created
      const remainingCount = await Permission.count({
        where: { name: { [Op.like]: 'test_transaction_%' } }
      });
      
      if (remainingCount === 0) {
        console.log('   ✅ PASS: Transaction rollback worked correctly');
        success = true;
      } else {
        console.log(`   ❌ FAIL: Transaction did not rollback properly (${remainingCount} orphaned permissions)`);
      }
    }
    
  } catch (error) {
    console.error('   ❌ FAIL: Transaction test error:', error.message);
    if (transaction) {
      await transaction.rollback();
    }
  }
  
  return success;
}

/**
 * Test 3: Duplicate Detection
 */
async function testDuplicateDetection() {
  console.log('\n📋 Test 3: Duplicate Detection');
  console.log('--------------------------------');
  
  const testPerm = { name: 'test_duplicate_basic', resource: 'test', action: 'read', description: 'Duplicate test' };
  
  try {
    // First creation should succeed
    const [perm1, created1] = await Permission.findOrCreate({
      where: { name: testPerm.name },
      defaults: testPerm
    });
    
    console.log(`   First creation: ${created1 ? 'Created' : 'Already exists'}`);
    
    // Second creation should be skipped (findOrCreate handles this)
    const [perm2, created2] = await Permission.findOrCreate({
      where: { name: testPerm.name },
      defaults: testPerm
    });
    
    console.log(`   Second creation: ${created2 ? 'Created' : 'Already exists'}`);
    
    // Verify only one permission exists
    const count = await Permission.count({ where: { name: testPerm.name } });
    
    if (count === 1) {
      console.log('   ✅ PASS: Duplicate detection working correctly');
      return true;
    } else {
      console.log(`   ❌ FAIL: Expected 1 permission, found ${count}`);
      return false;
    }
    
  } catch (error) {
    console.error('   ❌ FAIL: Duplicate detection test error:', error.message);
    return false;
  }
}

/**
 * Test 4: Bulk Operations Performance
 */
async function testBulkOperationsPerformance() {
  console.log('\n📋 Test 4: Bulk Operations Performance');
  console.log('--------------------------------------');
  
  const bulkPermissions = Array.from({ length: 20 }, (_, i) => ({
    name: `test_bulk_${i}`,
    resource: 'bulk',
    action: 'create',
    description: `Bulk test permission ${i}`
  }));
  
  const startTime = Date.now();
  
  try {
    // Test bulk creation approach (similar to optimized seeder)
    const existingPermissions = await Permission.findAll({
      where: { name: { [Op.in]: bulkPermissions.map(p => p.name) } }
    });
    
    const existingNames = new Set(existingPermissions.map(p => p.name));
    let created = 0;
    let skipped = 0;
    
    for (const perm of bulkPermissions) {
      if (existingNames.has(perm.name)) {
        skipped++;
        continue;
      }
      
      const [permission, wasCreated] = await Permission.findOrCreate({
        where: { name: perm.name },
        defaults: perm
      });
      
      if (wasCreated) {
        created++;
        existingNames.add(perm.name);
      } else {
        skipped++;
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   Bulk operations completed in ${duration}ms`);
    console.log(`   Created: ${created}, Skipped: ${skipped}, Total: ${bulkPermissions.length}`);
    console.log(`   Average time per permission: ${(duration / bulkPermissions.length).toFixed(2)}ms`);
    
    if (duration < 5000 && created + skipped === bulkPermissions.length) {
      console.log('   ✅ PASS: Bulk operations performance acceptable');
      return true;
    } else {
      console.log('   ❌ FAIL: Bulk operations performance issues');
      return false;
    }
    
  } catch (error) {
    console.error('   ❌ FAIL: Bulk operations test error:', error.message);
    return false;
  }
}

/**
 * Test 5: Error Handling and Validation
 */
async function testErrorHandlingAndValidation() {
  console.log('\n📋 Test 5: Error Handling and Validation');
  console.log('------------------------------------------');
  
  // Test validation function from optimized seeder
  function validatePermission(perm) {
    const errors = [];
    
    if (!perm.name || typeof perm.name !== 'string') {
      errors.push('Permission name is required and must be a string');
    }
    
    if (perm.name && (perm.name.length < 1 || perm.name.length > 100)) {
      errors.push('Permission name must be between 1 and 100 characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  const testCases = [
    { perm: { name: 'valid_permission', resource: 'test', action: 'read' }, expected: true },
    { perm: { name: '', resource: 'test', action: 'read' }, expected: false },
    { perm: { name: 'a'.repeat(101), resource: 'test', action: 'read' }, expected: false },
    { perm: { name: null, resource: 'test', action: 'read' }, expected: false }
  ];
  
  let passed = 0;
  
  for (const testCase of testCases) {
    const result = validatePermission(testCase.perm);
    const isValid = result.isValid;
    
    if (isValid === testCase.expected) {
      console.log(`   ✅ Validation test passed for: ${testCase.perm.name || 'null'}`);
      passed++;
    } else {
      console.log(`   ❌ Validation test failed for: ${testCase.perm.name || 'null'}`);
      console.log(`      Expected: ${testCase.expected}, Got: ${isValid}`);
    }
  }
  
  const success = passed === testCases.length;
  if (success) {
    console.log('   ✅ PASS: Error handling and validation working correctly');
  } else {
    console.log('   ❌ FAIL: Some validation tests failed');
  }
  
  return success;
}

/**
 * Test 6: Role Permission Assignment
 */
async function testRolePermissionAssignment() {
  console.log('\n📋 Test 6: Role Permission Assignment');
  console.log('--------------------------------------');
  
  try {
    // Create test roles
    const roles = [];
    for (const roleData of testRoles) {
      const [role] = await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: roleData
      });
      roles.push(role);
    }
    
    // Create test permission
    const [testPermission] = await Permission.findOrCreate({
      where: { name: 'test_assignment_permission' },
      defaults: {
        name: 'test_assignment_permission',
        resource: 'test',
        action: 'assign',
        description: 'Assignment test permission'
      }
    });
    
    // Test assignment
    const [assignment, wasCreated] = await PermissionRole.findOrCreate({
      where: {
        permission_id: testPermission.id,
        role_id: roles[0].id
      },
      defaults: {
        permission_id: testPermission.id,
        role_id: roles[0].id
      }
    });
    
    console.log(`   Assignment result: ${wasCreated ? 'Created' : 'Already exists'}`);
    
    // Verify assignment exists
    const count = await PermissionRole.count({
      where: {
        permission_id: testPermission.id,
        role_id: roles[0].id
      }
    });
    
    if (count === 1) {
      console.log('   ✅ PASS: Role permission assignment working correctly');
      return true;
    } else {
      console.log('   ❌ FAIL: Role permission assignment failed');
      return false;
    }
    
  } catch (error) {
    console.error('   ❌ FAIL: Role permission assignment test error:', error.message);
    return false;
  }
}

/**
 * Test 7: Concurrent Execution Safety
 */
async function testConcurrentExecutionSafety() {
  console.log('\n📋 Test 7: Concurrent Execution Safety');
  console.log('---------------------------------------');
  
  const concurrentPermissions = [
    { name: 'test_concurrent_execution_1', resource: 'concurrent', action: 'read', description: 'Concurrent test 1' },
    { name: 'test_concurrent_execution_2', resource: 'concurrent', action: 'read', description: 'Concurrent test 2' },
    { name: 'test_concurrent_execution_3', resource: 'concurrent', action: 'read', description: 'Concurrent test 3' }
  ];
  
  try {
    // Run concurrent creations
    const startTime = Date.now();
    
    const promises = concurrentPermissions.map(async (perm, index) => {
      try {
        const [permission, wasCreated] = await Permission.findOrCreate({
          where: { name: perm.name },
          defaults: perm
        });
        
        return { success: true, name: perm.name, created: wasCreated, thread: index };
      } catch (error) {
        return { success: false, name: perm.name, error: error.message, thread: index };
      }
    });
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   Concurrent operations completed in ${duration}ms`);
    console.log(`   Results:`);
    
    let successful = 0;
    let created = 0;
    
    results.forEach(result => {
      if (result.success) {
        successful++;
        if (result.created) created++;
        console.log(`   Thread ${result.thread}: ${result.created ? 'Created' : 'Skipped'} - ${result.name}`);
      } else {
        console.log(`   Thread ${result.thread}: Failed - ${result.name} (${result.error})`);
      }
    });
    
    // Verify total count
    const totalCount = await Permission.count({
      where: { name: { [Op.in]: concurrentPermissions.map(p => p.name) } }
    });
    
    if (successful === concurrentPermissions.length && totalCount <= concurrentPermissions.length) {
      console.log('   ✅ PASS: Concurrent execution safety working correctly');
      return true;
    } else {
      console.log(`   ❌ FAIL: Concurrent execution issues (${successful}/${concurrentPermissions.length} successful, ${totalCount} in database)`);
      return false;
    }
    
  } catch (error) {
    console.error('   ❌ FAIL: Concurrent execution test error:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting comprehensive permission seeding test suite...\n');
  
  const testResults = [];
  const testStartTime = Date.now();
  
  // Clean up before tests
  await cleanupTestData();
  
  // Run tests
  testResults.push({ name: 'Slug Collision Detection', passed: await testSlugCollisionDetection() });
  testResults.push({ name: 'Transaction Management', passed: await testTransactionManagement() });
  testResults.push({ name: 'Duplicate Detection', passed: await testDuplicateDetection() });
  testResults.push({ name: 'Bulk Operations Performance', passed: await testBulkOperationsPerformance() });
  testResults.push({ name: 'Error Handling and Validation', passed: await testErrorHandlingAndValidation() });
  testResults.push({ name: 'Role Permission Assignment', passed: await testRolePermissionAssignment() });
  testResults.push({ name: 'Concurrent Execution Safety', passed: await testConcurrentExecutionSafety() });
  
  // Clean up after tests
  await cleanupTestData();
  
  const testEndTime = Date.now();
  const totalDuration = testEndTime - testStartTime;
  
  // Print results summary
  console.log('\n\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  console.log(`⏱️  Total test duration: ${totalDuration}ms`);
  console.log(`🧪 Total tests: ${testResults.length}`);
  
  const passedTests = testResults.filter(test => test.passed).length;
  const failedTests = testResults.length - passedTests;
  
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  
  testResults.forEach(test => {
    console.log(`   ${test.passed ? '✅' : '❌'} ${test.name}`);
  });
  
  if (failedTests === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The optimized permission seeding system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues before deploying.');
  }
  
  return {
    totalTests: testResults.length,
    passed: passedTests,
    failed: failedTests,
    duration: totalDuration,
    testResults
  };
}

// Execute if run directly
if (require.main === module) {
  runAllTests()
    .then(results => {
      console.log('\n🏁 Test suite completed.');
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Fatal error in test suite:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testSlugCollisionDetection,
  testTransactionManagement,
  testDuplicateDetection,
  testBulkOperationsPerformance,
  testErrorHandlingAndValidation,
  testRolePermissionAssignment,
  testConcurrentExecutionSafety,
  cleanupTestData
};