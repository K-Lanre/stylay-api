const jwt = require('jsonwebtoken');
const tokenBlacklistService = require('../services/token-blacklist.service');

/**
 * Test script to verify database blacklist functionality
 */
async function testDatabaseBlacklist() {
  console.log('🧪 Testing Database Blacklist Implementation...\n');

  try {
    // Create a test token
    const testUser = { id: 1, email: 'test@example.com' };
    const testToken = jwt.sign(
      { id: testUser.id, email: testUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('✅ Test token created');
    
    // Check that token is NOT blacklisted initially
    const isInitiallyBlacklisted = await tokenBlacklistService.isTokenBlacklisted(testToken);
    console.log(`❓ Token initially blacklisted: ${isInitiallyBlacklisted}`);
    
    if (isInitiallyBlacklisted) {
      throw new Error('Test failed: Token should not be blacklisted initially');
    }
    
    // Blacklist the token
    const blacklistResult = await tokenBlacklistService.blacklistToken(testToken, 'test', testUser.id);
    console.log(`✅ Token blacklisting result: ${blacklistResult}`);
    
    if (!blacklistResult) {
      throw new Error('Test failed: Token should have been blacklisted');
    }
    
    // Check that token IS now blacklisted
    const isBlacklisted = await tokenBlacklistService.isTokenBlacklisted(testToken);
    console.log(`❓ Token after blacklisting: ${isBlacklisted}`);
    
    if (!isBlacklisted) {
      throw new Error('Test failed: Token should be blacklisted after blacklisting');
    }
    
    // Get statistics
    const stats = await tokenBlacklistService.getStats();
    console.log('📊 Blacklist Statistics:');
    console.log(`   - Redis available: ${stats.redis.available}`);
    console.log(`   - Redis connected: ${stats.redis.connected}`);
    console.log(`   - Database total blacklisted: ${stats.database.totalBlacklisted}`);
    console.log(`   - Database active blacklisted: ${stats.database.activeBlacklisted}`);
    
    console.log('\n✅ All tests passed! Database blacklist is working correctly.');
    
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDatabaseBlacklist()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = testDatabaseBlacklist;