#!/usr/bin/env node
'use strict';

/**
 * AUTH ROUTE PERMISSION IMPLEMENTATION VALIDATION
 * 
 * Validates that auth routes have been properly updated with permission middleware
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDATING AUTH ROUTE PERMISSION IMPLEMENTATION');
console.log('=' .repeat(60));

const authRoutesPath = path.join(__dirname, '..', 'routes', 'auth.route.js');

try {
  const authRoutesContent = fs.readFileSync(authRoutesPath, 'utf8');
  
  // Check for permission middleware imports
  const hasPermissionImport = authRoutesContent.includes('hasPermission');
  const isAdminOrHasPermissionImport = authRoutesContent.includes('isAdminOrHasPermission');
  
  console.log('\n📦 PERMISSION MIDDLEWARE IMPORTS:');
  console.log(`   ✅ hasPermission: ${hasPermissionImport ? 'FOUND' : 'MISSING'}`);
  console.log(`   ✅ isAdminOrHasPermission: ${isAdminOrHasPermissionImport ? 'FOUND' : 'MISSING'}`);
  
  // Check for permission usage in routes
  const permissionChecks = [
    'register_user',
    'register_admin', 
    'authenticate_user',
    'verify_email',
    'resend_verification',
    'request_password_reset',
    'reset_password',
    'verify_phone_change',
    'view_own_profile',
    'update_own_profile',
    'change_own_password',
    'request_phone_change',
    'cancel_phone_change',
    'logout_user',
    'view_pending_phone_changes',
    'approve_phone_change',
    'reject_phone_change'
  ];
  
  console.log('\n🔐 PERMISSION IMPLEMENTATION CHECKS:');
  let implementedCount = 0;
  permissionChecks.forEach(permission => {
    const isImplemented = authRoutesContent.includes(`'${permission}'`);
    console.log(`   ${isImplemented ? '✅' : '❌'} ${permission}: ${isImplemented ? 'IMPLEMENTED' : 'MISSING'}`);
    if (isImplemented) implementedCount++;
  });
  
  console.log('\n📊 VALIDATION RESULTS:');
  console.log(`   📈 Implementation: ${implementedCount}/${permissionChecks.length} permissions`);
  console.log(`   🎯 Success Rate: ${Math.round((implementedCount / permissionChecks.length) * 100)}%`);
  
  // Check middleware order
  console.log('\n🔄 MIDDLEWARE ORDER VALIDATION:');
  
  // Check public routes
  const publicRoutesPattern = /router\.post\("\/register".+?hasPermission\('register_user'\)/s;
  const publicRouteImplemented = publicRoutesPattern.test(authRoutesContent);
  console.log(`   ✅ Public routes order: ${publicRouteImplemented ? 'CORRECT' : 'NEEDS REVIEW'}`);
  
  // Check protected routes
  const protectedRoutesPattern = /router\.get\("\/me".+?protect.*?hasPermission\('view_own_profile'\)/s;
  const protectedRouteImplemented = protectedRoutesPattern.test(authRoutesContent);
  console.log(`   ✅ Protected routes order: ${protectedRouteImplemented ? 'CORRECT' : 'NEEDS REVIEW'}`);
  
  // Check admin routes
  const adminRoutesPattern = /router\.use\(restrictTo\("admin"\)\).+?hasPermission\('view_pending_phone_changes'\)/s;
  const adminRouteImplemented = adminRoutesPattern.test(authRoutesContent);
  console.log(`   ✅ Admin routes order: ${adminRouteImplemented ? 'CORRECT' : 'NEEDS REVIEW'}`);
  
  // Overall status
  console.log('\n' + '=' .repeat(60));
  if (implementedCount === permissionChecks.length && 
      publicRouteImplemented && 
      protectedRouteImplemented && 
      adminRouteImplemented) {
    console.log('🎉 AUTH ROUTE PERMISSION IMPLEMENTATION: SUCCESS');
    console.log('✅ All auth routes are properly protected with permissions');
    console.log('✅ Role-based restrictions are preserved for admin routes');
    console.log('✅ Middleware ordering is correct');
  } else {
    console.log('⚠️ AUTH ROUTE PERMISSION IMPLEMENTATION: INCOMPLETE');
    console.log('Please review the implementation and fix any issues');
  }
  console.log('=' .repeat(60));
  
} catch (error) {
  console.error('❌ ERROR reading auth routes file:', error.message);
}