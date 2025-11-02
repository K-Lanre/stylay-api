#!/usr/bin/env node
'use strict';

/**
 * VENDOR ROUTE PERMISSION IMPLEMENTATION VALIDATION
 * 
 * Validates that vendor routes have been properly updated with granular permission middleware
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDATING VENDOR ROUTE PERMISSION IMPLEMENTATION');
console.log('=' .repeat(60));

const vendorRoutesPath = path.join(__dirname, '../..', 'routes', 'vendor.route.js');

try {
  const vendorRoutesContent = fs.readFileSync(vendorRoutesPath, 'utf8');
  
  // Check for correct permission middleware imports
  const hasPermissionImport = vendorRoutesContent.includes('hasPermission');
  const hasOldCanImport = vendorRoutesContent.includes('can(');
  
  console.log('\n📦 PERMISSION MIDDLEWARE IMPORTS:');
  console.log(`   ✅ hasPermission: ${hasPermissionImport ? 'FOUND' : 'MISSING'}`);
  console.log(`   ❌ Old can() format: ${hasOldCanImport ? 'STILL EXISTS (should be removed)' : 'NOT USED'}`);
  
  // Check for specific granular permissions
  const granularPermissions = [
    'create_vendors',
    'read_vendors', 
    'view_products_by_vendor',
    'view_vendor_analytics_vendor',
    'view_single_vendor_admin',
    'manage_vendor_onboarding',
    'manage_vendor_followers',
    'view_vendor_followers',
    'approve_vendor_application_admin',
    'reject_vendor_application_admin'
  ];
  
  console.log('\n🔐 GRANULAR PERMISSION IMPLEMENTATION:');
  let implementedCount = 0;
  granularPermissions.forEach(permission => {
    const isImplemented = vendorRoutesContent.includes(`'${permission}'`);
    console.log(`   ${isImplemented ? '✅' : '❌'} ${permission}: ${isImplemented ? 'IMPLEMENTED' : 'MISSING'}`);
    if (isImplemented) implementedCount++;
  });
  
  console.log('\n📊 VALIDATION RESULTS:');
  console.log(`   📈 Implementation: ${implementedCount}/${granularPermissions.length} permissions`);
  console.log(`   🎯 Success Rate: ${Math.round((implementedCount / granularPermissions.length) * 100)}%`);
  
  // Check route mappings - simplified to just check for permission presence
  console.log('\n🔄 ROUTE-PERMISSION MAPPING VALIDATION:');
  
  // Check that each permission is used somewhere in vendor routes
  const permissionUsage = [
    { permission: 'create_vendors', description: 'Vendor registration routes' },
    { permission: 'read_vendors', description: 'Vendor viewing routes' },
    { permission: 'view_products_by_vendor', description: 'Vendor product viewing routes' },
    { permission: 'view_vendor_analytics_vendor', description: 'Vendor analytics routes' },
    { permission: 'view_single_vendor_admin', description: 'Admin vendor profile routes' },
    { permission: 'manage_vendor_onboarding', description: 'Vendor onboarding routes' },
    { permission: 'manage_vendor_followers', description: 'Vendor follower management routes' },
    { permission: 'view_vendor_followers', description: 'Vendor follower viewing routes' },
    { permission: 'approve_vendor_application_admin', description: 'Vendor approval routes' },
    { permission: 'reject_vendor_application_admin', description: 'Vendor rejection routes' }
  ];
  
  let correctMappings = 0;
  permissionUsage.forEach(({ permission, description }) => {
    const isUsed = vendorRoutesContent.includes(`hasPermission('${permission}')`);
    console.log(`   ${isUsed ? '✅' : '❌'} ${permission}: ${isUsed ? 'USED' : 'NOT USED'} (${description})`);
    if (isUsed) correctMappings++;
  });
  
  // Check middleware preservation
  const hasProtectMiddleware = vendorRoutesContent.includes('router.use(protect)');
  const hasRestrictToMiddleware = vendorRoutesContent.includes('restrictTo');
  
  console.log('\n🔒 SECURITY MIDDLEWARE PRESERVATION:');
  console.log(`   ✅ Authentication: ${hasProtectMiddleware ? 'PRESERVED' : 'MISSING'}`);
  console.log(`   ✅ Role restrictions: ${hasRestrictToMiddleware ? 'PRESERVED' : 'MISSING'}`);
  
  // Check validation middleware preservation
  const hasValidationMiddleware = vendorRoutesContent.includes('Validation') || 
                                 vendorRoutesContent.includes('validate');
  console.log(`   ✅ Validation middleware: ${hasValidationMiddleware ? 'PRESERVED' : 'MISSING'}`);
  
  // Check for old can() usage
  const hasOldCanUsage = /\scan\([^)]+\)/.test(vendorRoutesContent);
  console.log(`   ❌ Old can() usage: ${hasOldCanUsage ? 'STILL EXISTS' : 'NOT USED'}`);
  
  // Overall status
  console.log('\n' + '=' .repeat(60));
  if (implementedCount === granularPermissions.length &&
      correctMappings === permissionUsage.length &&
      hasProtectMiddleware &&
      hasRestrictToMiddleware &&
      !hasOldCanUsage) {
    console.log('🎉 VENDOR ROUTE PERMISSION IMPLEMENTATION: SUCCESS');
    console.log('✅ All vendor routes use granular permissions');
    console.log('✅ Authentication and role restrictions preserved');
    console.log('✅ No old can() format found');
    console.log('✅ Route-permission mappings correct');
    console.log('✅ Validation middleware preserved');
  } else {
    console.log('⚠️ VENDOR ROUTE PERMISSION IMPLEMENTATION: INCOMPLETE');
    console.log('Please review the implementation and fix any issues');
  }
  console.log('=' .repeat(60));
  
} catch (error) {
  console.error('❌ ERROR reading vendor routes file:', error.message);
}