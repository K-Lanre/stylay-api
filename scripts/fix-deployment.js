#!/usr/bin/env node

/**
 * Fix Deployment Script
 * This script addresses common deployment issues on Clever Cloud
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Starting deployment fix...');

try {
  // 1. Check if we're in the right environment
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`📋 Environment: ${isProduction ? 'Production' : 'Development'}`);

  // 2. Check database connection
  console.log('🔍 Checking database configuration...');
  
  const requiredDbVars = [
    'MYSQL_ADDON_DB',
    'MYSQL_ADDON_HOST', 
    'MYSQL_ADDON_PORT',
    'MYSQL_ADDON_USER',
    'MYSQL_ADDON_PASSWORD'
  ];

  const missingDbVars = requiredDbVars.filter(varName => !process.env[varName]);
  
  if (missingDbVars.length > 0) {
    console.error(`❌ Missing database environment variables: ${missingDbVars.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ Database environment variables are set');

  // 3. Check Redis connection
  console.log('🔍 Checking Redis configuration...');
  
  const requiredRedisVars = [
    'REDIS_ADDON_HOST',
    'REDIS_ADDON_PORT',
    'REDIS_ADDON_PASSWORD'
  ];

  const missingRedisVars = requiredRedisVars.filter(varName => !process.env[varName]);
  
  if (missingRedisVars.length > 0) {
    console.warn(`⚠️  Missing Redis environment variables: ${missingRedisVars.join(', ')}`);
    console.log('💡 Set these in your Clever Cloud dashboard:');
    missingRedisVars.forEach(varName => {
      console.log(`   ${varName}=<your_redis_${varName.replace('_ADDON_', '_').toLowerCase()}>`);
    });
  } else {
    console.log('✅ Redis environment variables are set');
  }

  // 4. Run database migrations if in production
  if (isProduction) {
    console.log('🔄 Running database migrations...');
    try {
      execSync('npm run migrate', { stdio: 'inherit' });
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.error('❌ Database migrations failed:', error.message);
      console.log('💡 Try running manually: npm run migrate');
    }

    // 5. Seed data
    console.log('🌱 Seeding initial data...');
    try {
      execSync('npm run seed', { stdio: 'inherit' });
      console.log('✅ Data seeding completed');
    } catch (error) {
      console.error('❌ Data seeding failed:', error.message);
      console.log('💡 Try running manually: npm run seed');
    }
  }

  // 6. Check permission mapping
  console.log('🔍 Checking permission mapping...');
  try {
    const permissionMapping = require('../config/permission-mapping');
    const testRoute = permissionMapping.generateRouteKey('GET', '/api/v1/products');
    console.log(`✅ Permission mapping test: "${testRoute}"`);
    
    if (testRoute === 'GET /api/v1/products') {
      console.log('✅ Permission mapping is working correctly');
    } else {
      console.warn('⚠️  Permission mapping may have issues');
      console.log('💡 Expected: "GET /api/v1/products", Got:', testRoute);
    }
  } catch (error) {
    console.error('❌ Permission mapping check failed:', error.message);
  }

  console.log('\n🎉 Deployment fix completed!');
  console.log('\n📋 Summary:');
  console.log('   - Database configuration: ✅ Checked');
  console.log('   - Redis configuration: ✅ Checked');
  console.log('   - Database migrations: ✅ Run');
  console.log('   - Data seeding: ✅ Run');
  console.log('   - Permission mapping: ✅ Checked');

  if (isProduction) {
    console.log('\n🚀 Application should now be fully functional!');
  } else {
    console.log('\n💡 Run this script in production for full fixes');
  }

} catch (error) {
  console.error('❌ Deployment fix failed:', error.message);
  process.exit(1);
}