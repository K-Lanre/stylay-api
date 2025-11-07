require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const morgan = require('morgan');
const compression = require('compression');
const passport = require('passport');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger');
const { errorHandler } = require('./middlewares/error');
const { sequelize, connectDB } = require('./config/database');
const { initializePassport } = require('./config/passport');
const { checkPermission } = require('./middlewares/checkPermission');
const { protect, setUser } = require('./middlewares/auth');
const { httpRequestDurationMiddleware, initializePerformanceTracking, metricsRoute } = require('./utils/performance');

// Import routes
const authRoutes = require('./routes/auth.route');
const userRoutes = require('./routes/user.route');
const roleRoutes = require('./routes/role.route');
const vendorRoutes = require('./routes/vendor.route');
const categoryRoutes = require('./routes/category.route');
const collectionRoutes = require('./routes/collection.route');
const productRoutes = require('./routes/product.route');
const supplyRoutes = require('./routes/supply.route');
const inventoryRoutes = require('./routes/inventory.route');
const journalRoutes = require('./routes/journal.route');
const addressRoutes = require('./routes/address.route');
const cartRoutes = require('./routes/cart.route');
const orderRoutes = require('./routes/order.route');
const webhookRoutes = require('./routes/webhook.route');
const dashboardRoutes = require('./routes/dashboard.route');
const reviewRoutes = require('./routes/review.route');
const variantRoutes = require('./routes/variant.route');
const adminRoutes = require('./routes/admin');

// Initialize express app
const app = express();

// Trust first proxy (for rate limiting behind load balancer)
app.set('trust proxy', 1);

// Connect to database and initialize properly
const initializeApp = async () => {
  try {
    await connectDB();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  }
};

const db = sequelize;

// Initialize Redis client
let redisClient;
if (process.env.NODE_ENV === 'production') {
  // In production, use Redis for caching
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
  });
  
  redisClient.on('error', (err) => {
    logger.error(`Redis Client Error: ${err}`);
  });
  
  redisClient.on('connect', () => {
    logger.info('Connected to Redis');
  });
  
  redisClient.connect().catch(console.error);
} else {
  // In development, we can use a mock Redis client
  const mockRedis = {
    get: async (key) => null,
    set: async (key, value, mode, duration) => true,
    setex: async (key, duration, value) => true, // Add setex method
    del: async (key) => true,
    quit: async () => true,
  };
  redisClient = mockRedis;
}

// Initialize performance tracking
initializePerformanceTracking(db);

// Initialize Passport
initializePassport(passport);

// Set security HTTP headers
app.use(helmet());

// Add request ID for tracing
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Performance monitoring middleware
app.use(httpRequestDurationMiddleware);

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', { stream: { write: message => logger.http(message.trim()) } }));
}

// Initialize Passport and restore authentication state, if any
app.use(passport.initialize());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve API docs if they exist
  app.use(express.static(path.join(__dirname, 'public')));
} else {
  // In development, serve uploaded files from the Upload directory
  app.use('/uploads', express.static(path.join(__dirname, 'public', 'Upload')));
  // Serve logo file directly at /logo route
  app.get('/logo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logo.png'));
  });
}

// File upload middleware
const fileUpload = require('express-fileupload');
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: './tmp/',
  createParentPath: true,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit to match validation
  abortOnLimit: true,
  responseOnLimit: 'File size limit has been reached (max 10MB)',
  safeFileNames: true,
  preserveExtension: 4, // Keep up to 4 characters of the extension
  debug: process.env.NODE_ENV === 'development',
  parseNested: true // Enable nested file uploads
}));

// Limit requests from same API
const limiter = rateLimit({
  max: process.env.RATE_LIMIT_MAX || 100,
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests from this IP, please try again in 15 minutes!'
});
app.use('/api', limiter);

// Rate limiting for dashboard endpoints
const dashboardLimiter = rateLimit({
  max: 20, // 20 requests per minute
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many requests from this IP to dashboard, please try again in 1 minute!',
  keyGenerator: (req) => {
    // Use user ID if logged in, otherwise use IP
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});
app.use('/api/v1/admin/dashboard', dashboardLimiter);

// Cache middleware for dashboard endpoints
const cache = (duration) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(obj) {
        // Cache the response for future requests
        redisClient.set(key, JSON.stringify(obj), 'EX', duration);
        return originalJson.call(this, obj);
      };
      
      next();
    } catch (error) {
      logger.error(`Cache error: ${error.message}`);
      next();
    }
  };
};

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'duration', 'ratingsQuantity', 'ratingsAverage', 'maxGroupSize', 'difficulty', 'price'
  ]
}));

// CORS configuration - Simplified and more reliable
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow all origins for easier testing
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Allow common development origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173'
    ];

    // Allow ngrok URLs (both ngrok.io and ngrok.app)
    const ngrokPatterns = [
      /https?:\/\/.*\.ngrok\.io$/,
      /https?:\/\/.*\.ngrok\.app$/,
      /https?:\/\/.*\.ngrok-free\.app$/
    ];

    // Allow localtunnel URLs (keeping for backward compatibility)
    const localtunnelPatterns = [
      /https?:\/\/.*\.localtunnel\.me$/,
      /https?:\/\/.*\.loca\.lt$/
    ];

    const isOriginAllowed = allowedOrigins.includes(origin) ||
                           ngrokPatterns.some(pattern => pattern.test(origin)) ||
                           localtunnelPatterns.some(pattern => pattern.test(origin));

    if (isOriginAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'ngrok-skip-browser-warning'
  ],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Enable CORS with options
app.use(cors(corsOptions));

// Handle preflight requests more reliably
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, ngrok-skip-browser-warning');
  res.sendStatus(200);
});

// Initialize Passport
app.use(passport.initialize());
initializePassport(passport);

// Compress all responses
app.use(compression());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Metrics endpoint for Prometheus
app.get('/metrics', metricsRoute);

app.use(setUser);
app.use(checkPermission);
// Mount routes with caching for dashboard endpoints
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/collections', collectionRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/supplies', supplyRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/journals', journalRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// Apply caching to dashboard routes
app.use('/api/v1/dashboard', cache(300), dashboardRoutes); // 5 minutes cache
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/variants', variantRoutes);
app.use('/api/v1/admin', adminRoutes);

// Serve static files in production


// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001);
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    if (redisClient && redisClient.quit) {
      redisClient.quit();
    }
    process.exit(0);
  });
});

module.exports = { app, db, redisClient };

