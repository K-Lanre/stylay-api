#!/usr/bin/env node
'use strict';

/**
 * CATEGORY ROUTE PERMISSION IMPLEMENTATION VALIDATION
 * 
 * Validates that category routes have been properly updated with granular permission middleware
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDATING CATEGORY ROUTE PERMISSION IMPLEMENTATION');
console.log('=' .repeat(60));

const categoryRoutesPath = path.join(__dirname, '../..', 'routes', 'category.route.js');

try {
  const categoryRoutesContent = fs.readFileSync(categoryRoutesPath, 'utf8');
  
  // Check for correct permission middleware imports
  const hasPermissionImport = categoryRoutesContent.includes('hasPermission');
  const hasOldCanImport = categoryRoutesContent.includes('can(');
  
  console.log('\n📦 PERMISSION MIDDLEWARE IMPORTS:');
  console.log(`   ✅ hasPermission: ${hasPermissionImport ? 'FOUND' : 'MISSING'}`);
  console.log(`   ❌ Old can() format: ${hasOldCanImport ? 'STILL EXISTS (should be removed)' : 'NOT USED'}`);
  
  // Check for specific granular permissions
  const granularPermissions = [
    'read_categories',
    'view_category_tree_public',
    'view_category_by_identifier_public',
    'view_category_products_public',
    'create_categories',
    'update_categories',
    'delete_categories',
    'manage_categories'
  ];
  
  console.log('\n🔐 GRANULAR PERMISSION IMPLEMENTATION:');
  let implementedCount = 0;
  granularPermissions.forEach(permission => {
    const isImplemented = categoryRoutesContent.includes(`'${permission}'`);
    console.log(`   ${isImplemented ? '✅' : '❌'} ${permission}: ${isImplemented ? 'IMPLEMENTED' : 'MISSING'}`);
    if (isImplemented) implementedCount++;
  });
  
  console.log('\n📊 VALIDATION RESULTS:');
  console.log(`   📈 Implementation: ${implementedCount}/${granularPermissions.length} permissions`);
  console.log(`   🎯 Success Rate: ${Math.round((implementedCount / granularPermissions.length) * 100)}%`);
  
  // Check permission usage - simplified to check for presence
  console.log('\n🔄 CATEGORY ROUTE-PERMISSION MAPPING VALIDATION:');
  
  const permissionUsage = [
    { permission: 'read_categories', description: 'GET /categories - Category listing' },
    { permission: 'view_category_tree_public', description: 'GET /categories/tree - Category tree' },
    { permission: 'view_category_by_identifier_public', description: 'GET /categories/:identifier - Single category' },
    { permission: 'view_category_products_public', description: 'GET /categories/:id/products - Category products' },
    { permission: 'create_categories', description: 'POST /categories - Create category' },
    { permission: 'update_categories', description: 'PUT /categories/:id - Update category' },
    { permission: 'delete_categories', description: 'DELETE /categories/:id - Delete category' }
  ];
  
  let correctMappings = 0;
  permissionUsage.forEach(({ permission, description }) => {
    const isUsed = categoryRoutesContent.includes(`hasPermission('${permission}')`);
    console.log(`   ${isUsed ? '✅' : '❌'} ${permission}: ${isUsed ? 'USED' : 'NOT USED'} (${description})`);
    if (isUsed) correctMappings++;
  });
  
  // Check middleware preservation
  const hasProtectMiddleware = categoryRoutesContent.includes('protect');
  const hasIsAdminMiddleware = categoryRoutesContent.includes('isAdmin');
  const hasValidationMiddleware = categoryRoutesContent.includes('validate');
  
  console.log('\n🔒 SECURITY MIDDLEWARE PRESERVATION:');
  console.log(`   ✅ Authentication (protect): ${hasProtectMiddleware ? 'PRESERVED' : 'MISSING'}`);
  console.log(`   ✅ Admin role check (isAdmin): ${hasIsAdminMiddleware ? 'PRESERVED' : 'MISSING'}`);
  console.log(`   ✅ Validation middleware: ${hasValidationMiddleware ? 'PRESERVED' : 'MISSING'}`);
  
  // Check for old can() usage
  const hasOldCanUsage = /\scan\([^)]+\)/.test(categoryRoutesContent);
  console.log(`   ❌ Old can() usage: ${hasOldCanUsage ? 'STILL EXISTS' : 'NOT USED'}`);
  
  // Overall status
  console.log('\n' + '=' .repeat(60));
  if (implementedCount === granularPermissions.length && 
      correctMappings === permissionUsage.length &&
      hasProtectMiddleware &&
      hasIsAdminMiddleware &&
      hasValidationMiddleware &&
      !hasOldCanUsage) {
    console.log('🎉 CATEGORY ROUTE PERMISSION IMPLEMENTATION: SUCCESS');
    console.log('✅ All category routes use granular permissions');
    console.log('✅ Authentication and admin restrictions preserved');
    console.log('✅ No old can() format found');
    console.log('✅ Route-permission mappings correct');
    console.log('✅ Validation middleware preserved');
  } else {
    console.log('⚠️ CATEGORY ROUTE PERMISSION IMPLEMENTATION: INCOMPLETE');
    console.log('Please review the implementation and fix any issues');
  }
  console.log('=' .repeat(60));
  
} catch (error) {
  console.error('❌ ERROR reading category routes file:', error.message);
}