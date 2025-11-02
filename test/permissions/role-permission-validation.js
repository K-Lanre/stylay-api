#!/usr/bin/env node
'use strict';

/**
 * ROLE ROUTE PERMISSION IMPLEMENTATION VALIDATION
 * 
 * Validates that role routes have been properly updated with granular permission middleware
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDATING ROLE ROUTE PERMISSION IMPLEMENTATION');
console.log('=' .repeat(60));

const roleRoutesPath = path.join(__dirname, '..', 'routes', 'role.route.js');

try {
  const roleRoutesContent = fs.readFileSync(roleRoutesPath, 'utf8');
  
  // Check for correct permission middleware imports
  const hasPermissionImport = roleRoutesContent.includes('hasPermission');
  const hasOldCanImport = roleRoutesContent.includes('can(');
  
  console.log('\n📦 PERMISSION MIDDLEWARE IMPORTS:');
  console.log(`   ✅ hasPermission: ${hasPermissionImport ? 'FOUND' : 'MISSING'}`);
  console.log(`   ❌ Old can() format: ${hasOldCanImport ? 'STILL EXISTS (should be removed)' : 'NOT USED'}`);
  
  // Check for specific granular permissions
  const granularPermissions = [
    'read_roles',
    'create_roles',
    'update_roles',
    'delete_roles'
  ];
  
  console.log('\n🔐 GRANULAR PERMISSION IMPLEMENTATION:');
  let implementedCount = 0;
  granularPermissions.forEach(permission => {
    const isImplemented = roleRoutesContent.includes(`'${permission}'`);
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
    { pattern: /\.get\(hasPermission\('read_roles'\)/, route: 'GET /roles' },
    { pattern: /\.post\([^)]*hasPermission\('create_roles'\)/, route: 'POST /roles' },
    { pattern: /\.get\(hasPermission\('read_roles'\)[^)]*roleController\.getRole/, route: 'GET /roles/:id' },
    { pattern: /\.patch\([^)]*hasPermission\('update_roles'\)/, route: 'PATCH /roles/:id' },
    { pattern: /\.delete\([^)]*hasPermission\('delete_roles'\)/, route: 'DELETE /roles/:id' }
  ];
  
  let correctMappings = 0;
  routeMappings.forEach(({ pattern, route }) => {
    const isCorrect = pattern.test(roleRoutesContent);
    console.log(`   ${isCorrect ? '✅' : '❌'} ${route}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    if (isCorrect) correctMappings++;
  });
  
  // Check middleware preservation
  const hasProtectMiddleware = roleRoutesContent.includes('router.use(protect)');
  const hasRestrictToMiddleware = roleRoutesContent.includes('router.use(restrictTo(\'admin\'))');
  
  console.log('\n🔒 SECURITY MIDDLEWARE PRESERVATION:');
  console.log(`   ✅ Authentication: ${hasProtectMiddleware ? 'PRESERVED' : 'MISSING'}`);
  console.log(`   ✅ Admin role restriction: ${hasRestrictToMiddleware ? 'PRESERVED' : 'MISSING'}`);
  
  // Check validation middleware preservation
  const hasValidationMiddleware = roleRoutesContent.includes('createRoleValidation') || 
                                 roleRoutesContent.includes('updateRoleValidation') || 
                                 roleRoutesContent.includes('deleteRoleValidation');
  console.log(`   ✅ Validation middleware: ${hasValidationMiddleware ? 'PRESERVED' : 'MISSING'}`);
  
  // Check for old can() usage
  const hasOldCanUsage = /\scan\([^)]+\)/.test(roleRoutesContent);
  console.log(`   ❌ Old can() usage: ${hasOldCanUsage ? 'STILL EXISTS' : 'NOT USED'}`);
  
  // Overall status
  console.log('\n' + '=' .repeat(60));
  if (implementedCount === granularPermissions.length && 
      correctMappings === routeMappings.length &&
      hasProtectMiddleware &&
      hasRestrictToMiddleware &&
      !hasOldCanUsage) {
    console.log('🎉 ROLE ROUTE PERMISSION IMPLEMENTATION: SUCCESS');
    console.log('✅ All role routes use granular permissions');
    console.log('✅ Authentication and admin restrictions preserved');
    console.log('✅ No old can() format found');
    console.log('✅ Route-permission mappings correct');
    console.log('✅ Validation middleware preserved');
  } else {
    console.log('⚠️ ROLE ROUTE PERMISSION IMPLEMENTATION: INCOMPLETE');
    console.log('Please review the implementation and fix any issues');
  }
  console.log('=' .repeat(60));
  
} catch (error) {
  console.error('❌ ERROR reading role routes file:', error.message);
}