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

const logger = require('./utils/logger');
const { errorHandler } = require('./middlewares/error');
const { connectDB } = require('./config/database');
const { initializePassport } = require('./config/passport');

// Import routes
const authRoutes = require('./routes/auth.route');
const userRoutes = require('./routes/user.route');
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
const adminRoutes = require('./routes/admin');

// Initialize express app
const app = express();

// Trust first proxy (for rate limiting behind load balancer)
app.set('trust proxy', 1);

// Connect to database
connectDB();

// Initialize Passport
initializePassport(passport);

// Set security HTTP headers
app.use(helmet());

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

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
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
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/admin', adminRoutes);

// Serve static files in production


// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;
