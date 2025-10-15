// Test script for tunnel functionality
require('dotenv').config();

const TunnelManager = require('./tunnel');

async function testTunnel() {
  console.log('Testing tunnel functionality...');

  const tunnelManager = new TunnelManager();

  try {
    // Test tunnel info when no tunnel is active
    console.log('Testing tunnel info (should show no active tunnel):');
    const info = tunnelManager.getTunnelInfo();
    console.log(info);

    console.log('\nTesting tunnel start...');
    const tunnel = await tunnelManager.start();

    console.log('\nTesting tunnel info (should show active tunnel):');
    const activeInfo = tunnelManager.getTunnelInfo();
    console.log(JSON.stringify(activeInfo, null, 2));

    console.log('\nTesting tunnel close...');
    await tunnelManager.close();

    console.log('\n✅ Tunnel functionality test completed successfully!');

  } catch (error) {
    console.error('❌ Tunnel test failed:', error.message);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testTunnel();
}

module.exports = testTunnel;
