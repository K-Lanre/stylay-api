const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: LocalStrategy } = require('passport-local');
const { User } = require('../models');
const logger = require('../utils/logger');

// JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  passReqToCallback: true
};

const initializePassport = (passport) => {
  // JWT Strategy
  passport.use(new JwtStrategy(jwtOptions, async (req, payload, done) => {
    try {
      const user = await User.findByPk(payload.sub);
      
      if (!user) {
        return done(null, false, { message: 'User not found' });
      }
      
      // Add user to request object
      req.user = user;
      return done(null, user);
    } catch (error) {
      logger.error('JWT Strategy Error:', error);
      return done(error, false);
    }
  }));

  // Local Strategy
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    session: false,
    passReqToCallback: true
  }, async (req, email, password, done) => {
    try {
      const user = await User.findOne({ where: { email } });
      
      if (!user) {
        return done(null, false, { message: 'Incorrect email or password' });
      }
      
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect email or password' });
      }
      
      return done(null, user);
    } catch (error) {
      logger.error('Local Strategy Error:', error);
      return done(error);
    }
  }));
};

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
