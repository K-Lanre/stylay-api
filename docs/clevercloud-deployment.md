# Clever Cloud Deployment Guide

This document provides comprehensive instructions for deploying the Stylay API to Clever Cloud with MySQL and Redis addons.

## Prerequisites

- Clever Cloud account
- Git CLI installed
- Node.js application ready for deployment
- Domain names for frontend, admin, and vendor portals

## Quick Start

### 1. Create Application on Clever Cloud

```bash
# Install Clever Cloud CLI
npm install -g clever-tools

# Login to Clever Cloud
clever login

# Create new application
clever create --type node stylay-api --region par
```

### 2. Configure Environment Variables

Set the following environment variables in your Clever Cloud dashboard:

```bash
# Application Configuration
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Database (automatically set by MySQL addon)
MYSQL_ADDON_DB=stylay_production
MYSQL_ADDON_HOST=your-mysql-host.clever-cloud.com
MYSQL_ADDON_PORT=3306
MYSQL_ADDON_USER=your_db_user
MYSQL_ADDON_PASSWORD=your_db_password

# Redis (automatically set by Redis addon)
REDIS_ADDON_HOST=your-redis-host.clever-cloud.com
REDIS_ADDON_PORT=6379
REDIS_ADDON_PASSWORD=your_redis_password

# Application Secrets (set as secrets in dashboard)
JWT_SECRET=your_jwt_secret_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
PAYSTACK_SECRET_KEY=your_paystack_secret
PAYSTACK_PUBLIC_KEY=your_paystack_public
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret
SESSION_SECRET=your_session_secret

# URLs
APP_URL=https://your-app.cleverapps.io
FRONTEND_URL=https://your-frontend-domain.com
ADMIN_URL=https://your-admin-domain.com
VENDOR_PORTAL_URL=https://your-vendor-domain.com
SUPPORT_EMAIL=support@yourdomain.com

# Payment Configuration
PAYSTACK_CALLBACK_URL=https://your-app.cleverapps.io/api/orders/verify
```

### 3. Add Database and Redis Addons

**For Linux/macOS (Bash):**
```bash
# Add MySQL addon
clever addon create mysql-addon --plan dev stylay-mysql \
  --link stylay-api \
  --region par \
  --version 8.0

# Add Redis addon
clever addon create redis-addon --plan dev stylay-redis \
  --link stylay-api \
  --region par \
  --version 6.2
```

**For Windows PowerShell:**
```powershell
# Add MySQL addon
clever addon create mysql-addon --plan dev stylay-mysql --link stylay-api --region par --version 8.0

# Add Redis addon
clever addon create redis-addon --plan dev stylay-redis --link stylay-api --region par --version 6.2
```

**For Windows Command Prompt (CMD):**
```cmd
clever addon create mysql-addon --plan dev stylay-mysql --link stylay-api --region par --version 8.0

clever addon create redis-addon --plan dev stylay-redis --link stylay-api --region par --version 6.2
```

### 4. Configure Git Deployment

```bash
# Add Clever Cloud as remote
git remote add clevercloud git+ssh://your-clever-cloud-repo.git

# Deploy to Clever Cloud
git push clevercloud main
```

## Configuration Files

### Application Configuration (`clevercloud/application.json`)

This file defines the application settings, scaling parameters, and addon configurations:

- **Type**: Node.js application
- **Version**: Node.js 18.x
- **Scaling**: 1-3 instances based on CPU usage
- **Memory**: 1-2 GB per instance
- **Addons**: MySQL and Redis development plans

### Environment Variables (`clevercloud/environment.json`)

Contains all environment-specific configurations including:
- Database connection strings
- Redis connection details
- JWT and session secrets
- Email configuration
- Payment gateway settings

### HTTP Routing (`clevercloud/http.json`)

Configures:
- Route definitions for API endpoints
- CORS settings
- Security headers (HSTS, CSP, etc.)
- Compression settings
- Caching rules

### Cron Jobs (`clevercloud/cron.json`)

Scheduled tasks:
- Daily database backup (2 AM UTC)
- Redis cache cleanup (3 AM UTC)
- File cleanup (4 AM UTC)
- Health checks (every 10 minutes)
- Token cleanup (1 AM UTC)
- Daily reports (6 AM UTC)

### Post-Deployment Hook (`clevercloud/hooks/postdeploy`)

Automated tasks after deployment:
1. Wait for database availability
2. Run database migrations
3. Seed initial data
4. Clear Redis cache
5. Set file permissions
6. Restart PM2 processes

## Database Setup

### Initial Migration

The application will automatically run migrations on first deployment via the post-deployment hook.

```bash
# Manual migration if needed
npm run migrate
```

### Database Backup

- Automatic daily backups at 2 AM UTC
- 30-day retention period
- Backups stored in Clever Cloud storage

### Monitoring

- Connection monitoring
- Query performance tracking
- Slow query logging
- Disk usage alerts

## Redis Configuration

### Cache Strategy

- Product listings: 5 minutes
- Categories: 10 minutes
- Collections: 10 minutes
- User sessions: 24 hours

### Backup

- Automatic daily backups at 3 AM UTC
- 7-day retention period

### Monitoring

- Memory usage tracking
- Connection monitoring
- Command execution metrics

## Security Configuration

### HTTPS/SSL

- Automatic SSL certificate management
- HSTS header enforcement
- HTTP to HTTPS redirect

### CORS

Allowed origins:
- Frontend domain
- Admin domain
- Vendor portal domain

### Security Headers

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

## Monitoring and Logging

### Application Metrics

- CPU usage
- Memory consumption
- Disk usage
- Network traffic
- Response times

### Log Management

- Structured JSON logging
- Log rotation (5 files, 10MB each)
- Centralized log collection

### Health Checks

- Endpoint: `/health`
- Frequency: Every 30 seconds
- Timeout: 10 seconds
- Max retries: 3

## Scaling Configuration

### Horizontal Scaling

- Minimum instances: 1
- Maximum instances: 3
- Scaling trigger: CPU usage > 70%

### Vertical Scaling

- Memory per instance: 1-2 GB
- Disk space: 10 GB

## Troubleshooting

### Common Issues

1. **Command Line Syntax Errors (PowerShell/CMD)**
   - Use single-line commands instead of backslash line continuations
   - For PowerShell: `clever addon create mysql-addon --plan dev stylay-mysql --link stylay-api --region par --version 8.0`
   - For CMD: Same as PowerShell, no backslashes needed
   - For Bash: Backslash continuations are supported

2. **Database Connection Timeout**
   - Check MySQL addon status
   - Verify environment variables
   - Check network connectivity

3. **Redis Connection Issues**
   - Verify Redis addon status
   - Check password authentication
   - Monitor memory usage

4. **Deployment Failures**
   - Check build logs in dashboard
   - Verify package.json scripts
   - Check disk space

5. **Git Push Issues**
   - Ensure SSH keys are properly configured
   - Verify remote URL is correct
   - Check Clever Cloud application permissions

### Debug Commands

```bash
# View application logs
clever logs

# SSH into application
clever ssh

# Check addon status
clever addon list

# View environment variables
clever env
```

### Performance Optimization

1. **Database Optimization**
   - Enable query caching
   - Optimize slow queries
   - Use connection pooling

2. **Redis Optimization**
   - Monitor memory usage
   - Configure eviction policies
   - Use appropriate data structures

3. **Application Optimization**
   - Enable compression
   - Use CDN for static assets
   - Implement caching strategies

## Cost Management

### Addon Costs

- MySQL Dev: ~$10/month
- Redis Dev: ~$5/month
- Application instances: ~$15/month per instance

### Cost Optimization

- Monitor usage patterns
- Adjust instance count based on traffic
- Review backup retention policies
- Clean up unused resources

## Support

For additional support:
- [Clever Cloud Documentation](https://www.clever-cloud.com/doc/)
- [Clever Cloud Community](https://community.clever-cloud.com/)
- [GitHub Issues](https://github.com/your-repo/issues)