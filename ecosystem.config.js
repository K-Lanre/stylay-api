module.exports = {
  apps: [
    {
      name: 'stylay-api',
      script: 'app.js',
      instances: 'max', // Use maximum available instances
      exec_mode: 'cluster', // Run in cluster mode
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8080
      },
      env_clevercloud: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8080,
        // Clever Cloud specific environment variables
        CC_APM_ENABLED: 'true',
        CC_APM_LOG_LEVEL: 'info'
      },
      // Enable auto-restart if the app crashes
      autorestart: true,
      // Restart the app if it uses more than 1GB of memory
      max_memory_restart: '512M',
      // Log file configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Merge logs from different instances into a single file
      merge_logs: true,
      // Save the process list to a file for persistence
      pmx: true,
      // Graceful shutdown timeout
      kill_timeout: 5000,
      // Instance variable for cluster mode
      instance_var: 'INSTANCE_ID',
      // Watch for changes in development
      watch: process.env.NODE_ENV === 'development',
      // Ignore watch patterns
      ignore_watch: ['node_modules', 'logs', '.git'],
      // Max number of log files
      max_files: 5,
      // Max size of log files
      max_size: '10M'
    }
  ],
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:K-Lanre/stylay-api.git',
      path: '/var/www/stylay-api',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    },
    clevercloud: {
      user: 'clevercloud',
      host: 'git.clever-cloud.com',
      ref: 'origin/main',
      repo: 'git@github.com:K-Lanre/stylay-api.git',
      path: '/app',
      'pre-deploy-local': 'git fetch --all && git reset --hard origin/main',
      'post-deploy': 'npm install --production && npm run migrate && pm2 reload ecosystem.config.js --env clevercloud',
      'pre-setup': 'npm install -g pm2',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=1024',
        CC_RUN_COMMAND: 'npm start',
        CC_WORKER_COMMAND: 'npm run worker',
        CC_WEB_PROCESS: 'npm start',
        CC_WORKER_PROCESS: 'npm run worker',
        NPM_CONFIG_PRODUCTION: 'false'
      }
    }
  }
};