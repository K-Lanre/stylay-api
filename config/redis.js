const redis = require('redis');

// Check if Redis should be enabled
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

let client = null;
let isConnected = false;

if (REDIS_ENABLED) {
  // Create Redis client with promise-based API (redis v4+)
  client = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          console.warn('Redis: Max reconnection attempts reached. Disabling Redis caching.');
          return false; // Stop reconnecting
        }
        return Math.min(retries * 100, 1000);
      }
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB) || 0,
  });

  client.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      console.warn('Redis: Connection refused. Running without Redis caching.');
    } else {
      console.error('Redis Client Error:', err.message);
    }
    isConnected = false;
  });

  client.on('connect', () => {
    console.log('Redis: Connecting...');
  });

  client.on('ready', () => {
    console.log('Redis: Connected and ready');
    isConnected = true;
  });

  client.on('end', () => {
    console.log('Redis: Connection closed');
    isConnected = false;
  });

  // Connect to Redis with graceful fallback
  (async () => {
    try {
      await client.connect();
    } catch (err) {
      console.warn('Redis: Failed to connect. Application will run without Redis caching.');
      console.warn('Redis Error:', err.message);
      isConnected = false;
    }
  })();
} else {
  console.log('Redis: Disabled via environment variable');
}

// Enhanced fallback implementations for Redis operations
const createFallbackRedis = () => ({
  // Connection status properties
  isConnected: false,
  isEnabled: false,

  // String operations
  get: async (key) => {
    console.warn(`Redis fallback: GET ${key} - returning null`);
    return null;
  },
  
  set: async (key, value, mode, duration) => {
    console.warn(`Redis fallback: SET ${key} - returning true`);
    return true;
  },
  
  setex: async (key, duration, value) => {
    console.warn(`Redis fallback: SETEX ${key} - returning true`);
    return true;
  },
  
  del: async (key) => {
    console.warn(`Redis fallback: DEL ${key} - returning true`);
    return true;
  },
  
  exists: async (key) => {
    console.warn(`Redis fallback: EXISTS ${key} - returning 0`);
    return 0;
  },
  
  expire: async (key, seconds) => {
    console.warn(`Redis fallback: EXPIRE ${key} ${seconds} - returning true`);
    return true;
  },

  // List operations
  lRange: async (key, start, stop) => {
    console.warn(`Redis fallback: LRANGE ${key} ${start} ${stop} - returning []`);
    return [];
  },
  
  lrange: async (key, start, stop) => {
    console.warn(`Redis fallback: lrange ${key} ${start} ${stop} - returning []`);
    return [];
  },
  
  lPush: async (key, ...values) => {
    console.warn(`Redis fallback: LPUSH ${key} ${values.length} items - returning list length`);
    return values.length;
  },
  
  lpush: async (key, ...values) => {
    console.warn(`Redis fallback: lpush ${key} ${values.length} items - returning list length`);
    return values.length;
  },
  
  rPush: async (key, ...values) => {
    console.warn(`Redis fallback: RPUSH ${key} ${values.length} items - returning list length`);
    return values.length;
  },
  
  rpush: async (key, ...values) => {
    console.warn(`Redis fallback: rpush ${key} ${values.length} items - returning list length`);
    return values.length;
  },
  
  lTrim: async (key, start, stop) => {
    console.warn(`Redis fallback: LTRIM ${key} ${start} ${stop} - returning true`);
    return true;
  },
  
  ltrim: async (key, start, stop) => {
    console.warn(`Redis fallback: ltrim ${key} ${start} ${stop} - returning true`);
    return true;
  },
  
  lRem: async (key, count, value) => {
    console.warn(`Redis fallback: LREM ${key} ${count} ${value} - returning 0 (not found)`);
    return 0;
  },
  
  lrem: async (key, count, value) => {
    console.warn(`Redis fallback: lrem ${key} ${count} ${value} - returning 0 (not found)`);
    return 0;
  },

  // Hash operations
  hSet: async (key, field, value) => {
    console.warn(`Redis fallback: HSET ${key} ${field} - returning 0 (new field)`);
    return 0;
  },
  
  hset: async (key, field, value) => {
    console.warn(`Redis fallback: hset ${key} ${field} - returning 0 (new field)`);
    return 0;
  },
  
  hGet: async (key, field) => {
    console.warn(`Redis fallback: HGET ${key} ${field} - returning null`);
    return null;
  },
  
  hget: async (key, field) => {
    console.warn(`Redis fallback: hget ${key} ${field} - returning null`);
    return null;
  },
  
  hDel: async (key, field) => {
    console.warn(`Redis fallback: HDEL ${key} ${field} - returning 0`);
    return 0;
  },
  
  hdel: async (key, field) => {
    console.warn(`Redis fallback: hdel ${key} ${field} - returning 0`);
    return 0;
  },

  // Set operations
  sAdd: async (key, member) => {
    console.warn(`Redis fallback: SADD ${key} ${member} - returning 1 (new member)`);
    return 1;
  },
  
  sadd: async (key, member) => {
    console.warn(`Redis fallback: sadd ${key} ${member} - returning 1 (new member)`);
    return 1;
  },
  
  sRem: async (key, member) => {
    console.warn(`Redis fallback: SREM ${key} ${member} - returning 0 (not found)`);
    return 0;
  },
  
  srem: async (key, member) => {
    console.warn(`Redis fallback: srem ${key} ${member} - returning 0 (not found)`);
    return 0;
  },
  
  sMembers: async (key) => {
    console.warn(`Redis fallback: SMEMBERS ${key} - returning []`);
    return [];
  },
  
  smembers: async (key) => {
    console.warn(`Redis fallback: smembers ${key} - returning []`);
    return [];
  },

  // Connection operations
  quit: async () => {
    console.warn('Redis fallback: QUIT - returning true');
    return true;
  },

  // Generic fallback for any other method
  ping: async () => {
    console.warn('Redis fallback: PING - returning "PONG"');
    return 'PONG';
  }
});

// Export a proxy that gracefully handles Redis unavailability
module.exports = new Proxy(createFallbackRedis(), {
  get: (target, prop) => {
    // Special properties
    if (prop === 'isConnected') {
      return isConnected;
    }
    if (prop === 'isEnabled') {
      return REDIS_ENABLED && client !== null;
    }
    
    // If Redis is not available, use the fallback
    if (!client || !isConnected) {
      // Return the fallback method if it exists (support both camelCase and lowercase)
      if (target[prop] && typeof target[prop] === 'function') {
        return target[prop];
      }
      // Return a generic no-op function for unknown operations
      return async (...args) => {
        console.warn(`Redis fallback: ${prop} ${args.length > 0 ? args.join(' ') : ''} - no-op function called`);
        return null;
      };
    }
    
    // Return the actual Redis client method
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    
    // If the method doesn't exist on the client, try fallback or return undefined
    if (target[prop] && typeof target[prop] === 'function') {
      console.warn(`Redis client missing method ${prop}, using fallback`);
      return target[prop];
    }
    
    return value;
  }
});