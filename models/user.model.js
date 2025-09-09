// models/user.js
'use strict';
const bcrypt = require('bcryptjs');
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Address, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Notification, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Order, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Review, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.SupportFeedback, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.OversightLog, {
        foreignKey: 'admin_id'
      });
      User.hasMany(models.PaymentTransaction, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Vendor, {
        foreignKey: 'user_id'
      });
      User.hasMany(models.Vendor, {
        foreignKey: 'approved_by',
        as: 'approved_vendors'
      });
      User.belongsToMany(models.Role, {
        through: {
          model: models.UserRole,
          as: 'userRoles'
        },
        foreignKey: 'user_id',
        otherKey: 'role_id',
        as: 'roles'
      });
      
      User.hasMany(models.UserRole, {
        foreignKey: 'user_id',
        as: 'userRoles'
      });
    }

  }

  User.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'User\'s date of birth',
      validate: {
        isDate: {
          msg: 'Please provide a valid date of birth'
        },
        isBefore: new Date().toISOString().split('T')[0],
        isAfter: '1900-01-01'
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true
    },
    email_verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    email_verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    email_verification_token_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    password_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_changed_at'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: 1
    },
    profile_image: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.NOW
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true
  });

  // Instance method to check if password was changed after a specific timestamp
  User.prototype.changedPasswordAfter = function(JWTTimestamp) {
    if (this.password_changed_at) {
      const changedTimestamp = parseInt(
        this.password_changed_at.getTime() / 1000,
        10
      );
      return JWTTimestamp < changedTimestamp;
    }
    // False means NOT changed
    return false;
  };

  // Add instance methods to User prototype
  User.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  };

  /**
   * Check if verification token is expired
   * @returns {Object} Returns an object with status and message
   * @property {boolean} isExpired - Whether the token is expired
   * @property {string} message - Human-readable message about token status
   * @property {Date|null} expiresAt - When the token expires (null if no expiration set)
   */
  User.prototype.getTokenStatus = function() {
    if (!this.email_verification_token_expires) {
      return {
        isExpired: true,
        message: 'No verification token found. Please request a new verification code.',
        expiresAt: null
      };
    }

    const now = new Date();
    const isExpired = now > this.email_verification_token_expires;
    
    if (isExpired) {
      return {
        isExpired: true,
        message: 'Verification code has expired. Please request a new one.',
        expiresAt: this.email_verification_token_expires
      };
    }

    // Calculate remaining time in minutes
    const remainingMinutes = Math.ceil((this.email_verification_token_expires - now) / (1000 * 60));
    
    return {
      isExpired: false,
      message: `Verification code is valid for ${remainingMinutes} more minute${remainingMinutes !== 1 ? 's' : ''}.`,
      expiresAt: this.email_verification_token_expires
    };
  };

  // For backward compatibility
  User.prototype.isVerificationTokenExpired = function() {
    return this.getTokenStatus().isExpired;
  };

  return User;
};