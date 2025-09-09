const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: LocalStrategy } = require('passport-local');
const { User, Role } = require('../models');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

// JWT Strategy Options
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  issuer: process.env.APP_NAME || 'Stylay',
  audience: 'user',
  passReqToCallback: true
};

const initializePassport = (passport) => {
  // JWT Strategy
  passport.use('jwt', new JwtStrategy(jwtOptions, async (req, payload, done) => {
    try {
      const user = await User.findByPk(payload.id, {
        include: [{
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name', 'description']
        }]
      });
      
      if (!user) {
        return done(null, false, { message: 'User not found' });
      }
      
      // Check if user changed password after token was issued
      if (user.changedPasswordAfter(payload.iat)) {
        return done(null, false, { 
          message: 'User recently changed password! Please log in again.' 
        });
      }

      return done(null, user.get({ plain: true }));
    } catch (error) {
      logger.error('JWT Strategy Error:', error);
      return done(error, false);
    }
  }));

  // Local Strategy for email/password login
  passport.use('local', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    session: false,
    passReqToCallback: true
  }, async (req, email, password, done) => {
    try {
      // First, find the user without including roles to get the model instance
      const user = await User.findOne({ 
        where: { email }
      });
      
      if (!user) {
        return done(null, false, { message: 'Incorrect email or password' });
      }
      
      // Compare passwords using the model instance method
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect email or password' });
      }

      // Now fetch the user with roles for the response
      const userWithRoles = await User.findByPk(user.id, {
        include: [{
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name', 'description']
        }]
      });

      return done(null, userWithRoles.get({ plain: true }));
    } catch (error) {
      logger.error('Local Strategy Error:', error);
      return done(error);
    }
  }));

  // Serialize user into the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id, {
        include: [{
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          attributes: ['id', 'name', 'description']
        }]
      });
      done(null, user?.get({ plain: true }) || null);
    } catch (error) {
      done(error);
    }
  });
};

module.exports = initializePassport;

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = {
  initializePassport,
  passport
};
