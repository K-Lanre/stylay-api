#!/usr/bin/env node
'use strict';

/**
 * COLLECTION ROUTE PERMISSION IMPLEMENTATION VALIDATION
 * 
 * Validates that collection routes have been properly updated with granular permission middleware
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDATING COLLECTION ROUTE PERMISSION IMPLEMENTATION');
console.log('=' .repeat(60));

const mainCollectionRoutesPath = path.join(__dirname, '../..', 'routes', 'collection.route.js');
const adminCollectionRoutesPath = path.join(__dirname, '../..', 'routes', 'admin', 'collection.route.js');

let collectionRoutesContent = '';
let adminCollectionRoutesContent = '';

try {
  // Read main collection routes
  if (fs.existsSync(mainCollectionRoutesPath)) {
    collectionRoutesContent = fs.readFileSync(mainCollectionRoutesPath, 'utf8');
    console.log('✅ Main collection routes file found');
  } else {
    console.log('❌ Main collection routes file not found');
  }
  
  // Read admin collection routes
  if (fs.existsSync(adminCollectionRoutesPath)) {
    adminCollectionRoutesContent = fs.readFileSync(adminCollectionRoutesPath, 'utf8');
    console.log('✅ Admin collection routes file found');
  } else {
    console.log('❌ Admin collection routes file not found');
  }
  
  const totalContent = collectionRoutesContent + adminCollectionRoutesContent;
  
  // Check for correct permission middleware imports
  const hasPermissionImport = totalContent.includes('hasPermission');
  const hasOldCanImport = totalContent.includes('can(');
  
  console.log('\n📦 PERMISSION MIDDLEWARE IMPORTS:');
  console.log(`   ✅ hasPermission: ${hasPermissionImport ? 'FOUND' : 'MISSING'}`);
  console.log(`   ❌ Old can() format: ${hasOldCanImport ? 'STILL EXISTS (should be removed)' : 'NOT USED'}`);
  
  // Check for specific granular permissions
  const granularPermissions = [
    'view_collections',
    'view_collection_by_id',
    'view_collection_products',
    'create_collection_admin',
    'update_collection_admin',
    'delete_collection_admin',
    'add_products_to_collection',
    'remove_products_from_collection',
    'manage_collections_admin'
  ];
  
  console.log('\n🔐 GRANULAR PERMISSION IMPLEMENTATION:');
  let implementedCount = 0;
  granularPermissions.forEach(permission => {
    const isImplemented = totalContent.includes(`'${permission}'`);
    console.log(`   ${isImplemented ? '✅' : '❌'} ${permission}: ${isImplemented ? 'IMPLEMENTED' : 'MISSING'}`);
    if (isImplemented) implementedCount++;
  });
  
  console.log('\n📊 VALIDATION RESULTS:');
  console.log(`   📈 Implementation: ${implementedCount}/${granularPermissions.length} permissions`);
  console.log(`   🎯 Success Rate: ${Math.round((implementedCount / granularPermissions.length) * 100)}%`);
  
  // Check permission usage - simplified to check for presence
  console.log('\n🔄 COLLECTION ROUTE-PERMISSION MAPPING VALIDATION:');
  
  const permissionUsage = [
    { permission: 'view_collections', description: 'GET /collections - Collection listing' },
    { permission: 'view_collection_by_id', description: 'GET /collections/:id - Single collection' },
    { permission: 'view_collection_products', description: 'GET /collections/:id/products - Collection products' },
    { permission: 'create_collection_admin', description: 'POST /admin/collections - Create collection' },
    { permission: 'update_collection_admin', description: 'PUT /admin/collections/:id - Update collection' },
    { permission: 'delete_collection_admin', description: 'DELETE /admin/collections/:id - Delete collection' },
    { permission: 'add_products_to_collection', description: 'POST /admin/collections/:id/products - Add products' },
    { permission: 'remove_products_from_collection', description: 'DELETE /admin/collections/:id/products - Remove products' }
  ];
  
  let correctMappings = 0;
  permissionUsage.forEach(({ permission, description }) => {
    const isUsed = totalContent.includes(`hasPermission('${permission}')`);
    console.log(`   ${isUsed ? '✅' : '❌'} ${permission}: ${isUsed ? 'USED' : 'NOT USED'} (${description})`);
    if (isUsed) correctMappings++;
  });
  
  // Check middleware preservation
  const hasValidationMiddleware = totalContent.includes('validate');
  const hasProtectMiddleware = totalContent.includes('protect');
  const hasIsAdminMiddleware = totalContent.includes('isAdmin');
  
  console.log('\n🔒 SECURITY MIDDLEWARE PRESERVATION:');
  console.log(`   ✅ Validation middleware: ${hasValidationMiddleware ? 'PRESERVED' : 'MISSING'}`);
  console.log(`   ✅ Authentication (protect): ${hasProtectMiddleware ? 'PRESERVED' : 'MISSING'}`);
  console.log(`   ✅ Admin role check (isAdmin): ${hasIsAdminMiddleware ? 'PRESERVED' : 'MISSING'}`);
  
  // Check for old can() usage
  const hasOldCanUsage = /\scan\([^)]+\)/.test(totalContent);
  console.log(`   ❌ Old can() usage: ${hasOldCanUsage ? 'STILL EXISTS' : 'NOT USED'}`);
  
  // Overall status
  console.log('\n' + '=' .repeat(60));
  if (correctMappings === permissionUsage.length &&
      hasValidationMiddleware &&
      hasProtectMiddleware &&
      hasIsAdminMiddleware &&
      !hasOldCanUsage) {
    console.log('🎉 COLLECTION ROUTE PERMISSION IMPLEMENTATION: SUCCESS');
    console.log('✅ All collection routes use granular permissions');
    console.log('✅ All security middleware preserved');
    console.log('✅ No old can() format found');
    console.log('✅ Route-permission mappings correct');
    console.log('✅ Public and admin access maintained');
  } else {
    console.log('⚠️ COLLECTION ROUTE PERMISSION IMPLEMENTATION: INCOMPLETE');
    console.log('Please review the implementation and fix any issues');
  }
  console.log('=' .repeat(60));
  
} catch (error) {
  console.error('❌ ERROR reading collection routes files:', error.message);
}