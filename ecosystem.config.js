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
        PORT: 3000
      },
      // Enable auto-restart if the app crashes
      autorestart: true,
      // Restart the app if it uses more than 1GB of memory
      max_memory_restart: '1G',
      // Log file configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Merge logs from different instances into a single file
      merge_logs: true,
      // Save the process list to a file for persistence
      pmx: true
    }
  ],
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/stylay-api.git',
      path: '/var/www/stylay-api',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};