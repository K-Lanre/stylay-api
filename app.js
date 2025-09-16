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
const roleRoutes = require('./routes/role.route');
const vendorRoutes = require('./routes/vendor.route');
const categoryRoutes = require('./routes/category.route');
const collectionRoutes = require('./routes/collection.route');
const productRoutes = require('./routes/product.route');
const supplyRoutes = require('./routes/supply.route');
const inventoryRoutes = require('./routes/inventory.route');
const journalRoutes = require('./routes/journal.route');
const addressRoutes = require('./routes/address.route');
const orderRoutes = require('./routes/order.route');
const webhookRoutes = require('./routes/webhook.route');
// const reviewRoutes = require('./routes/reviews');

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
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve API docs if they exist
  app.use(express.static(path.join(__dirname, 'public')));
} else {
  // In development, serve uploaded files from the Upload directory
  app.use('/uploads', express.static(path.join(__dirname, 'public', 'Upload')));
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve API docs if they exist
  app.use(express.static(path.join(__dirname, 'public')));
} else {
  // In development, serve uploaded files from the Upload directory
  app.use('/uploads', express.static(path.join(__dirname, 'public', 'Upload')));
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

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5173',  // Vite default port
  'http://127.0.0.1:5173',  // Vite default port with IP
  'https://merry-jennet-lenient.ngrok-free.app',  // Current ngrok URL
  'http://localhost:3000',  // React default port
  'http://localhost:3001',  // Common React port
  /https?:\/\/.*\.ngrok\.io$/,  // Allow any ngrok.io subdomain
  /https?:\/\/.*\.ngrok-free\.app$/,  // Allow ngrok-free.app subdomains
  /^http:\/\/localhost:\d+$/,  // Allow any localhost with any port
  /^https?:\/\/localhost:\d+$/  // Allow any localhost with any port (https)
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Check if the origin matches any of the allowed patterns
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return pattern === origin;
      } else if (pattern instanceof RegExp) {
        return pattern.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      return callback(null, true);
    }
    
    const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
    console.error(msg);
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Forwarded-For',
    'Accept',
    'Accept-Version',
    'Content-Length',
    'Content-MD5',
    'Date',
    'X-Api-Version',
    'X-Response-Time',
    'X-PINGOTHER',
    'X-CSRF-Token',
    'Origin',
    'X-Access-Token',
    'ngrok-skip-browser-warning',
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'withCredentials'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Total-Count',
    'X-Access-Token',
    'X-Refresh-Token',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'Access-Control-Expose-Headers'
  ],
  maxAge: 86400 // 24 hours
};

// Enable CORS with options
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Add manual CORS headers as a fallback
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.some(pattern => {
    if (typeof pattern === 'string') return pattern === origin;
    if (pattern instanceof RegExp) return pattern.test(origin);
    return false;
  })) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, Accept, Origin, X-Access-Token, ngrok-skip-browser-warning');
    return res.status(200).end();
  }
  
  next();
});

// Initialize Passport
app.use(passport.initialize());
initializePassport(passport);

// Compress all responses
app.use(compression());

// Mount routes
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
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
// app.use('/api/v1/reviews', reviewRoutes);

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
