#!/usr/bin/env node

/**
 * Test script to validate file cleanup functionality
 * Run this script to test the file upload and cleanup mechanism
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('=== File Cleanup Diagnostic Test ===\n');

// Test 1: Check if cleanup directories exist
console.log('1. Checking upload directories...');
const uploadDirs = [
  'public/Upload/vendor-assets',
  'public/Upload/product-images',
  'public/Upload/user-avatars'
];

uploadDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`✓ Directory exists: ${dir}`);
    const files = fs.readdirSync(fullPath);
    console.log(`  Files in directory: ${files.length}`);
    if (files.length > 0) {
      console.log(`  Sample files: ${files.slice(0, 3).join(', ')}`);
    }
  } else {
    console.log(`✗ Directory missing: ${dir}`);
  }
});

// Test 2: Check for orphaned files
console.log('\n2. Checking for potentially orphaned files...');
const vendorAssetsDir = path.join(process.cwd(), 'public/Upload/vendor-assets');
if (fs.existsSync(vendorAssetsDir)) {
  const files = fs.readdirSync(vendorAssetsDir);
  const orphanedFiles = [];
  
  files.forEach(file => {
    const filePath = path.join(vendorAssetsDir, file);
    const stats = fs.statSync(filePath);
    const ageHours = (Date.now() - stats.birthtimeMs) / (1000 * 60 * 60);
    
    // Consider files older than 24 hours as potentially orphaned
    if (ageHours > 24) {
      orphanedFiles.push({
        name: file,
        ageHours: Math.round(ageHours),
        size: stats.size
      });
    }
  });
  
  console.log(`Found ${orphanedFiles.length} potentially orphaned files (older than 24 hours):`);
  orphanedFiles.slice(0, 10).forEach(file => {
    console.log(`  - ${file.name} (${file.ageHours}h old, ${file.size} bytes)`);
  });
  
  if (orphanedFiles.length > 10) {
    console.log(`  ... and ${orphanedFiles.length - 10} more`);
  }
}

// Test 3: Check database consistency (if possible)
console.log('\n3. Database consistency check...');
try {
  // Try to require the models to check if we can connect
  const { Store } = require('./models');
  
  if (Store) {
    console.log('✓ Database models loaded successfully');
    console.log('  Note: Full database consistency check requires running application');
  }
} catch (error) {
  console.log('✗ Cannot load database models:', error.message);
}

console.log('\n=== Test Complete ===');
console.log('\nTo test the actual cleanup mechanism:');
console.log('1. Start the application');
console.log('2. Make a request to /api/v1/vendors/complete-onboarding that will fail');
console.log('3. Check the console logs for the diagnostic output');
console.log('4. Verify that uploaded files are properly cleaned up');