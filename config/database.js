const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD || null, // Handle empty password case
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    define: {
      timestamps: true, // Enable Sequelize's built-in timestamps
      underscored: true,
      // Tell Sequelize to use the snake_case column names for timestamps
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      // Handle empty password case for MySQL
      password: process.env.DB_PASSWORD || '',
      // Add support for big numbers
      supportBigNumbers: true,
      bigNumberStrings: true
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

const syncDB = async (force = false) => {
  try {
    await sequelize.sync({ force });
    logger.info('Database synchronized');
  } catch (error) {
    logger.error('Error syncing database:', error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  connectDB,
  syncDB,
  Sequelize
};
