const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Test Script for File Upload Integration in updateProfile
 * 
 * This script tests the complete workflow from Postman to database
 * for the updated updateProfile method with file upload support.
 */

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test data
const testUser = {
  first_name: 'Test',
  last_name: 'User',
  email: `test.user.${Date.now()}@example.com`,
  password: 'TestPassword123!',
  phone: '+2348012345678',
  gender: 'other'
};

const testProfileUpdates = {
  first_name: 'Updated',
  last_name: 'Profile',
  phone: '+2348012345679',
  gender: 'female'
};

const testImage = {
  path: path.join(__dirname, 'test-image.jpg'),
  name: 'test-profile-image.jpg'
};

// Global variables
let authToken = '';
let userId = '';

async function runTests() {
  console.log('🧪 Starting File Upload Integration Tests\n');
  
  try {
    // Test 1: Verify middleware import and route configuration
    console.log('1️⃣ Testing middleware import and route configuration...');
    await testMiddlewareConfiguration();
    
    // Test 2: Register a test user
    console.log('2️⃣ Testing user registration...');
    await registerTestUser();
    
    // Test 3: Login to get auth token
    console.log('3️⃣ Testing user login...');
    await loginUser();
    
    // Test 4: Create a test image file
    console.log('4️⃣ Creating test image file...');
    await createTestImage();
    
    // Test 5: Test profile update without file
    console.log('5️⃣ Testing profile update without file...');
    await testProfileUpdateWithoutFile();
    
    // Test 6: Test profile update with file upload
    console.log('6️⃣ Testing profile update with file upload...');
    await testProfileUpdateWithFile();
    
    // Test 7: Verify file was saved to correct location
    console.log('7️⃣ Verifying file storage...');
    await verifyFileStorage();
    
    // Test 8: Verify database update
    console.log('8️⃣ Verifying database update...');
    await verifyDatabaseUpdate();
    
    // Test 9: Test Postman collection format
    console.log('9️⃣ Testing Postman collection format...');
    await testPostmanCollection();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary of Changes Verified:');
    console.log('   ✓ File upload middleware integrated');
    console.log('   ✓ Route configuration updated');
    console.log('   ✓ Controller handles uploaded files');
    console.log('   ✓ Postman collection uses form-data');
    console.log('   ✓ File storage working correctly');
    console.log('   ✓ Database updates working correctly');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nDebug info:', error.response?.data || error);
    process.exit(1);
  }
}

async function testMiddlewareConfiguration() {
  // Check if file upload middleware is properly imported
  const routeFile = fs.readFileSync(path.join(__dirname, 'routes/auth.route.js'), 'utf8');
  
  if (!routeFile.includes('uploadFiles')) {
    throw new Error('File upload middleware not imported in routes/auth.route.js');
  }
  
  if (!routeFile.includes("uploadFiles('profile_image', 1, 'user-avatars')")) {
    throw new Error('File upload middleware not configured for updateProfile route');
  }
  
  console.log('   ✓ Middleware properly imported and configured');
}

async function registerTestUser() {
  const response = await axios.post(`${BASE_URL}/api/v1/auth/register`, testUser);
  
  if (response.status !== 201) {
    throw new Error(`Registration failed: ${response.status}`);
  }
  
  userId = response.data.data.user.id;
  console.log(`   ✓ User registered with ID: ${userId}`);
}

async function loginUser() {
  const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
    email: testUser.email,
    password: testUser.password
  });
  
  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`);
  }
  
  authToken = response.data.token;
  console.log('   ✓ User logged in successfully');
}

async function createTestImage() {
  // Create a simple test image (PNG format - simpler than JPEG)
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x00, 0x01, 0xDD, 0x65, 0x3A, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  fs.writeFileSync(testImage.path, pngHeader);
  console.log('   ✓ Test image created');
}

async function testProfileUpdateWithoutFile() {
  const response = await axios.put(`${BASE_URL}/api/v1/auth/me`, testProfileUpdates, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.status !== 200) {
    throw new Error(`Profile update without file failed: ${response.status}`);
  }
  
  if (response.data.data.user.first_name !== testProfileUpdates.first_name) {
    throw new Error('Profile data not updated correctly');
  }
  
  console.log('   ✓ Profile update without file works correctly');
}

async function testProfileUpdateWithFile() {
  const FormData = require('form-data');
  const form = new FormData();
  
  // Add form fields
  Object.keys(testProfileUpdates).forEach(key => {
    form.append(key, testProfileUpdates[key]);
  });
  
  // Add file
  form.append('profile_image', fs.createReadStream(testImage.path));
  
  const response = await axios.put(`${BASE_URL}/api/v1/auth/me`, form, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      ...form.getHeaders()
    }
  });
  
  if (response.status !== 200) {
    throw new Error(`Profile update with file failed: ${response.status}`);
  }
  
  const updatedUser = response.data.data.user;
  if (!updatedUser.profile_image || !updatedUser.profile_image.includes('user-avatars')) {
    throw new Error('Profile image URL not updated correctly');
  }
  
  console.log('   ✓ Profile update with file upload works correctly');
  console.log(`   ✓ Profile image URL: ${updatedUser.profile_image}`);
}

async function verifyFileStorage() {
  // Check if the file exists in the expected location
  const expectedPath = path.join(__dirname, 'public', 'Upload', 'user-avatars');
  
  if (!fs.existsSync(expectedPath)) {
    throw new Error('User avatars directory does not exist');
  }
  
  const files = fs.readdirSync(expectedPath);
  if (files.length === 0) {
    throw new Error('No files found in user avatars directory');
  }
  
  console.log('   ✓ File stored in correct location');
  console.log(`   ✓ Files in directory: ${files.join(', ')}`);
}

async function verifyDatabaseUpdate() {
  // Get user data to verify database was updated
  const response = await axios.get(`${BASE_URL}/api/v1/auth/me`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  const userData = response.data.data.user;
  
  if (!userData.profile_image || !userData.profile_image.includes('user-avatars')) {
    throw new Error('Database not updated with profile image URL');
  }
  
  console.log('   ✓ Database updated with profile image URL');
  console.log(`   ✓ User profile image: ${userData.profile_image}`);
}

async function testPostmanCollection() {
  // Verify Postman collection has correct format
  const postmanFile = path.join(__dirname, 'postman', 'Stylay-API-Updated.postman_collection.json');
  
  if (!fs.existsSync(postmanFile)) {
    throw new Error('Postman collection file not found');
  }
  
  const collection = JSON.parse(fs.readFileSync(postmanFile, 'utf8'));
  
  // Find the Update Profile request
  const updateProfileRequest = collection.item
    .find(item => item.name === 'Authentication')
    ?.item
    .find(req => req.name === 'Update Profile');
  
  if (!updateProfileRequest) {
    throw new Error('Update Profile request not found in Postman collection');
  }
  
  if (updateProfileRequest.request.body.mode !== 'formdata') {
    throw new Error('Postman collection not updated to form-data mode');
  }
  
  const profileImageField = updateProfileRequest.request.body.formdata
    .find(field => field.key === 'profile_image');
  
  if (!profileImageField || profileImageField.type !== 'file') {
    throw new Error('Profile image field not configured correctly in Postman');
  }
  
  console.log('   ✓ Postman collection correctly configured for file uploads');
  console.log('   ✓ Request mode: form-data');
  console.log('   ✓ Profile image field: file type');
}

// Cleanup function
function cleanup() {
  console.log('\n🧹 Cleaning up test files...');
  
  // Remove test image
  if (fs.existsSync(testImage.path)) {
    fs.unlinkSync(testImage.path);
    console.log('   ✓ Test image removed');
  }
  
  // Remove uploaded files (if any)
  const uploadDir = path.join(__dirname, 'public', 'Upload', 'user-avatars');
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    files.forEach(file => {
      if (file.includes('test') || file.includes('profile')) {
        fs.unlinkSync(path.join(uploadDir, file));
        console.log(`   ✓ Removed: ${file}`);
      }
    });
  }
}

// Run tests and cleanup on exit
runTests().then(() => {
  cleanup();
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test execution failed:', error);
  cleanup();
  process.exit(1);
});