const { DataTypes, Op } = require('sequelize');

/**
 * Token Blacklist Model
 * Stores blacklisted JWT tokens for session management
 */
module.exports = (sequelize, DataTypes) => {
  const TokenBlacklist = sequelize.define('TokenBlacklist', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: 'SHA256 hash of the blacklisted token'
    },
    token_expiry: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'Unix timestamp when the original token expires'
    },
    blacklisted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When the token was blacklisted'
    },
    reason: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'logout',
      comment: 'Reason for blacklisting (logout, password_change, etc.)'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID of the user whose token was blacklisted (if applicable)'
    }
  }, {
    tableName: 'token_blacklist',
    timestamps: true, // This will add createdAt and updatedAt
    indexes: [
      {
        name: 'idx_token_blacklist_hash',
        unique: true,
        fields: ['token_hash']
      },
      {
        name: 'idx_token_blacklist_expiry',
        fields: ['token_expiry']
      },
      {
        name: 'idx_token_blacklist_user',
        fields: ['user_id']
      }
    ]
  });

  /**
   * Auto-cleanup expired blacklist entries
   * This should be called periodically
   */
  TokenBlacklist.cleanupExpired = async function() {
    try {
      const now = Date.now();
      const deletedCount = await this.destroy({
        where: {
          tokenExpiry: {
            [Op.lt]: now
          }
        }
      });
      
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired blacklist entries`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired blacklist entries:', error);
      throw error;
    }
  };

  return TokenBlacklist;
};