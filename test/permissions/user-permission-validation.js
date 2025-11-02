#!/usr/bin/env node
'use strict';

/**
 * USER ROUTE PERMISSION IMPLEMENTATION VALIDATION
 * 
 * Validates that user routes have been properly updated with granular permission middleware
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDATING USER ROUTE PERMISSION IMPLEMENTATION');
console.log('=' .repeat(60));

const userRoutesPath = path.join(__dirname, '..', 'routes', 'user.route.js');

try {
  const userRoutesContent = fs.readFileSync(userRoutesPath, 'utf8');
  
  // Check for correct permission middleware imports
  const hasPermissionImport = userRoutesContent.includes('hasPermission');
  const hasCanImport = userRoutesContent.includes('can(');
  
  console.log('\n📦 PERMISSION MIDDLEWARE IMPORTS:');
  console.log(`   ✅ hasPermission: ${hasPermissionImport ? 'FOUND' : 'MISSING'}`);
  console.log(`   ❌ can() old format: ${hasCanImport ? 'STILL EXISTS (should be removed)' : 'REMOVED'}`);
  
  // Check for specific granular permissions
  const granularPermissions = [
    'view_users_admin',
    'create_users',
    'view_single_user_admin',
    'update_users',
    'delete_users',
    'assign_user_roles_admin',
    'remove_user_roles_admin'
  ];
  
  console.log('\n🔐 GRANULAR PERMISSION IMPLEMENTATION:');
  let implementedCount = 0;
  granularPermissions.forEach(permission => {
    const isImplemented = userRoutesContent.includes(`'${permission}'`);
    console.log(`   ${isImplemented ? '✅' : '❌'} ${permission}: ${isImplemented ? 'IMPLEMENTED' : 'MISSING'}`);
    if (isImplemented) implementedCount++;
  });
  
  console.log('\n📊 VALIDATION RESULTS:');
  console.log(`   📈 Implementation: ${implementedCount}/${granularPermissions.length} permissions`);
  console.log(`   🎯 Success Rate: ${Math.round((implementedCount / granularPermissions.length) * 100)}%`);
  
  // Check route mappings
  console.log('\n🔄 ROUTE-PERMISSION MAPPING VALIDATION:');
  
  // Check route patterns (using correct patterns that match the actual implementation)
  const routeMappings = [
    { pattern: /\.get\(hasPermission\('view_users_admin'\)/, route: 'GET /users' },
    { pattern: /\.post\([^)]*hasPermission\('create_users'\)/, route: 'POST /users' },
    { pattern: /\.get\(hasPermission\('view_single_user_admin'\)/, route: 'GET /users/:id' },
    { pattern: /\.patch\([^)]*hasPermission\('update_users'\)/, route: 'PATCH /users/:id' },
    { pattern: /\.delete\(hasPermission\('delete_users'\)/, route: 'DELETE /users/:id' },
    { pattern: /\.post\([^)]*hasPermission\('assign_user_roles_admin'\)/, route: 'POST /users/:id/roles' },
    { pattern: /\.delete\([^)]*hasPermission\('remove_user_roles_admin'\)/, route: 'DELETE /users/:id/roles' }
  ];
  
  let correctMappings = 0;
  routeMappings.forEach(({ pattern, route }) => {
    const isCorrect = pattern.test(userRoutesContent);
    console.log(`   ${isCorrect ? '✅' : '❌'} ${route}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    if (isCorrect) correctMappings++;
  });
  
  // Check middleware preservation
  const hasProtectMiddleware = userRoutesContent.includes('router.use(protect)');
  const hasRestrictToMiddleware = userRoutesContent.includes('router.use(restrictTo(\'admin\'))');
  
  console.log('\n🔒 SECURITY MIDDLEWARE PRESERVATION:');
  console.log(`   ✅ Authentication: ${hasProtectMiddleware ? 'PRESERVED' : 'MISSING'}`);
  console.log(`   ✅ Admin role restriction: ${hasRestrictToMiddleware ? 'PRESERVED' : 'MISSING'}`);
  
  // Check for old can() usage
  const hasOldCanUsage = /\scan\([^)]+\)/.test(userRoutesContent);
  console.log(`   ❌ Old can() usage: ${hasOldCanUsage ? 'STILL EXISTS' : 'REMOVED'}`);
  
  // Overall status
  console.log('\n' + '=' .repeat(60));
  if (implementedCount === granularPermissions.length && 
      correctMappings === routeMappings.length &&
      hasProtectMiddleware &&
      hasRestrictToMiddleware &&
      !hasOldCanUsage) {
    console.log('🎉 USER ROUTE PERMISSION IMPLEMENTATION: SUCCESS');
    console.log('✅ All user routes use granular permissions');
    console.log('✅ Authentication and admin restrictions preserved');
    console.log('✅ Old can() format completely removed');
    console.log('✅ Route-permission mappings correct');
  } else {
    console.log('⚠️ USER ROUTE PERMISSION IMPLEMENTATION: INCOMPLETE');
    console.log('Please review the implementation and fix any issues');
  }
  console.log('=' .repeat(60));
  
} catch (error) {
  console.error('❌ ERROR reading user routes file:', error.message);
}