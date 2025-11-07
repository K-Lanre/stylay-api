const redis = require('redis');

// Create the same Redis client configuration as in app.js
let client;
if (process.env.NODE_ENV === 'production') {
  // In production, use real Redis
  client = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
  });
} else {
  // In development, use a mock Redis client
  client = {
    get: async (key) => null,
    set: async (key, value, mode, duration) => true,
    setex: async (key, duration, value) => true, // Add setex method
    del: async (key) => true,
    quit: async () => true,
  };
}

const cache = (duration) => {
  return async (req, res, next) => {
    const key = req.originalUrl;
    
    try {
      const cachedData = await client.get(key);

      if (cachedData) {
        const data = JSON.parse(cachedData);
        res.send(data);
        return;
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }

    const originalSend = res.send;
    res.send = async function (data) {
      try {
        if (client.setex) {
          await client.setex(key, duration, data);
        } else {
          await client.set(key, data, 'EX', duration);
        }
      } catch (error) {
        console.error('Cache write error:', error);
      }
      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = cache;