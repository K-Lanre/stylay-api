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
const cartRoutes = require('./routes/cart.route');
const addressRoutes = require('./routes/address.route');
const orderRoutes = require('./routes/order.route');
// const reviewRoutes = require('./routes/reviews');

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', { stream: { write: message => logger.http(message.trim()) } }));
}

// File upload middleware
const fileUpload = require('express-fileupload');
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: './tmp/',
  createParentPath: true,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  abortOnLimit: true,
  responseOnLimit: 'File size limit has been reached',
  safeFileNames: true,
  preserveExtension: true,
  debug: process.env.NODE_ENV === 'development'
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

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

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
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/orders', orderRoutes);
// app.use('/api/v1/reviews', reviewRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve API docs if they exist
  app.use(express.static(path.join(__dirname, 'public')));
} else {
  // In development, serve uploaded files
  app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
}

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
