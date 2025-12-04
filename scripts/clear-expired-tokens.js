const { sequelize } = require('../config/database');
const TokenBlacklist = require('../models/token-blacklist.model');

async function clearExpiredTokens() {
  try {
    console.log('Clearing expired tokens...');
    
    const result = await TokenBlacklist.destroy({
      where: {
        expiresAt: {
          [sequelize.Op.lt]: new Date()
        }
      }
    });
    
    console.log(`Cleared ${result} expired tokens`);
  } catch (error) {
    console.error('Error clearing expired tokens:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

clearExpiredTokens();