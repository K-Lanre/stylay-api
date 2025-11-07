const promClient = require('prom-client');

// Create a new registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5]
});

const dbQueryTotal = new promClient.Counter({
  name: 'db_query_total',
  help: 'Total number of database queries',
  labelNames: ['query_type', 'table']
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbQueryTotal);

// Middleware for tracking HTTP request duration
const httpRequestDurationMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e9; // Convert nanoseconds to seconds

    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode;

    httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);

    httpRequestsTotal
      .labels(method, route, statusCode)
      .inc();
  });

  next();
};

// Function to track DB query duration
const trackDBQuery = (queryType, table, queryFn) => {
  return async (...args) => {
    const start = process.hrtime.bigint();

    try {
      const result = await queryFn(...args);

      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9; // Convert nanoseconds to seconds

      dbQueryDuration
        .labels(queryType, table)
        .observe(duration);

      dbQueryTotal
        .labels(queryType, table)
        .inc();

      return result;
    } catch (error) {
      // If query fails, still track the duration
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9;

      dbQueryDuration
        .labels(queryType, table)
        .observe(duration);

      dbQueryTotal
        .labels(queryType, table)
        .inc();

      throw error;
    }
  };
};

// Function to wrap Sequelize model methods for query tracking
const trackSequelizeQuery = (model, methodName) => {
  const originalMethod = model[methodName];
  
  if (typeof originalMethod === 'function') {
    model[methodName] = async function(...args) {
      return trackDBQuery(methodName, this.tableName, originalMethod.bind(this))(...args);
    };
  }
};

// Function to track all common Sequelize query methods for a model
const trackSequelizeModel = (model) => {
  const queryMethods = ['findAll', 'findOne', 'findByPk', 'count', 'sum', 'max', 'min', 'create', 'update', 'destroy'];
  
  queryMethods.forEach(method => trackSequelizeQuery(model, method));
};

// Function to initialize performance tracking for Sequelize models
const initializePerformanceTracking = (db) => {
  // Track all models
  Object.keys(db).forEach(modelName => {
    const model = db[modelName];
    if (model.sequelize) {
      trackSequelizeModel(model);
    }
  });
};

// Get metrics for Prometheus
const getMetrics = async () => {
  return await register.metrics();
};

// Express route to expose metrics
const metricsRoute = async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await getMetrics());
};

module.exports = {
  httpRequestDurationMiddleware,
  trackDBQuery,
  trackSequelizeQuery,
  trackSequelizeModel,
  initializePerformanceTracking,
  getMetrics,
  metricsRoute
};