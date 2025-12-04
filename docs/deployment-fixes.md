# Deployment Fixes Guide

This document provides comprehensive fixes for common deployment issues on Clever Cloud.

## Issues Fixed

### 1. MySQL Connection Pool Limit Exceeded

**Problem**: `User 'udzxlcvfbfbj0qts' has exceeded the 'max_user_connections' resource (current value: 5)`

**Root Cause**: Application was configured for 20 database connections per process, but MySQL addon only allows 5 total connections.

**Fix Applied**:
- Reduced connection pool in `config/database.js`: `max: 20` → `max: 4`
- Reduced connection pool in `config/config.js`: `max: 20` → `max: 4`
- Changed PM2 instances from `max` to `1` to prevent multiple connection pools
- Changed PM2 exec mode from `cluster` to `fork`

### 2. Missing Database Tables

**Problem**: `Table 'bej5e3fkuffhcumuonlf.users' doesn't exist`

**Root Cause**: Database migrations weren't running during deployment.

**Fix Applied**:
- Updated `clevercloud/application.json` deploy command to: `npm install && npm run migrate && npm run seed`
- Enhanced `clevercloud/hooks/postdeploy` script with better error handling
- Added database existence check and creation in post-deployment hook

### 3. Redis Connection Issues

**Problem**: `Redis Client Error: Error: connect ECONNREFUSED 127.0.0.1:6379`

**Root Cause**: Application was trying to connect to local Redis instead of Clever Cloud Redis addon.

**Fix Applied**:
- Updated `clevercloud/redis.json` with proper Redis addon configuration
- Added Redis environment variables to `clevercloud/environment.json`
- Enhanced Redis connection logic in `config/redis.js` with graceful fallback

### 4. Permission Mapping Issues

**Problem**: Malformed route keys in permission system

**Root Cause**: Path normalization issues in permission mapping logic.

**Fix Applied**:
- Enhanced `config/permission-mapping.js` with better path normalization
- Added debug logging for permission checks
- Improved route pattern matching

## Files Modified

### Configuration Files
- [`config/database.js`](../config/database.js) - Reduced connection pool to 4 max connections
- [`config/config.js`](../config/config.js) - Updated production database pool settings
- [`ecosystem.config.js`](../ecosystem.config.js) - Changed to single instance, fork mode
- [`clevercloud/application.json`](../clevercloud/application.json) - Fixed deploy command
- [`clevercloud/hooks/postdeploy`](../clevercloud/hooks/postdeploy) - Enhanced with error handling
- [`clevercloud/redis.json`](../clevercloud/redis.json) - Proper Redis addon configuration
- [`clevercloud/environment.json`](../clevercloud/environment.json) - Added Redis environment variables

### Utility Scripts
- [`scripts/fix-deployment.js`](../scripts/fix-deployment.js) - Comprehensive deployment fix script

### Package Configuration
- [`package.json`](../package.json) - Added `fix:deployment` script

## Deployment Commands

### Initial Deployment
```bash
git add .
git commit -m "fix: comprehensive deployment fixes for Clever Cloud"
git push clevercloud main
```

### Manual Fixes (if needed)

#### Run Fix Script
```bash
# SSH into your Clever Cloud application
clever ssh

# Run the comprehensive fix script
npm run fix:deployment
```

#### Manual Database Setup
```bash
# SSH into your Clever Cloud application
clever ssh

# Run migrations manually
npm run migrate

# Run seed data
npm run seed
```

#### Check Environment Variables
```bash
# SSH into your Clever Cloud application
clever ssh

# Check database environment variables
echo "MySQL DB: $MYSQL_ADDON_DB"
echo "MySQL Host: $MYSQL_ADDON_HOST"
echo "MySQL User: $MYSQL_ADDON_USER"

# Check Redis environment variables
echo "Redis Host: $REDIS_ADDON_HOST"
echo "Redis Port: $REDIS_ADDON_PORT"
```

## Environment Variables to Set in Clever Cloud Dashboard

### Required Database Variables (should be auto-set)
- `MYSQL_ADDON_DB=bej5e3fkuffhcumuonlf`
- `MYSQL_ADDON_HOST=bej5e3fkuffhcumuonlf-mysql.services.clever-cloud.com`
- `MYSQL_ADDON_PORT=3306`
- `MYSQL_ADDON_USER=udzxlcvfbfbj0qts`
- `MYSQL_ADDON_PASSWORD=9P3ymfTfEK94BwsQjwXq`

### Required Redis Variables (set manually)
- `REDIS_ADDON_HOST=your-redis-host.services.clever-cloud.com`
- `REDIS_ADDON_PORT=6379`
- `REDIS_ADDON_PASSWORD=your_redis_password`

### Required Application Variables
- `NODE_ENV=production`
- `PORT=8080`
- `LOG_LEVEL=info`
- `REDIS_ENABLED=true`

### Secret Variables (set as secrets)
- `JWT_SECRET=your_jwt_secret`
- `EMAIL_PASS=your_email_password`
- `PAYSTACK_SECRET_KEY=your_paystack_secret`
- `PAYSTACK_PUBLIC_KEY=your_paystack_public`
- `DEFAULT_VENDOR_PASSWORD=Vendor@123`
- `DEFAULT_CUSTOMER_PASSWORD=Customer@123`
- `DEFAULT_ADMIN_PASSWORD=Admin@123`
- `DEFAULT_SUBADMIN_PASSWORD=Subadmin@123`
- `SESSION_SECRET=your_session_secret`

## Monitoring and Verification

### Check Application Status
```bash
# View application logs
clever logs

# Check application health
curl https://app-23bc1a06-d77f-44cd-bf52-3ba2d30ca986.cleverapps.io/health

# Test login endpoint
curl -X POST https://app-23bc1a06-d77f-44cd-bf52-3ba2d30ca986.cleverapps.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Check Database Connection
```bash
# SSH into application
clever ssh

# Test database connection
mysql -h $MYSQL_ADDON_HOST -P $MYSQL_ADDON_PORT -u $MYSQL_ADDON_USER -p$MYSQL_ADDON_PASSWORD -e "USE $MYSQL_ADDON_DB; SHOW TABLES;"
```

### Check Redis Connection
```bash
# SSH into application
clever ssh

# Test Redis connection
redis-cli -h $REDIS_ADDON_HOST -p $REDIS_ADDON_PORT -a $REDIS_ADDON_PASSWORD ping
```

## Troubleshooting

### Database Issues
1. **Connection refused**: Check `MYSQL_ADDON_*` environment variables
2. **Tables missing**: Run `npm run migrate` manually
3. **Too many connections**: Verify connection pool settings are `max: 4`

### Redis Issues
1. **Connection refused**: Set `REDIS_ADDON_*` environment variables in dashboard
2. **Authentication failed**: Verify `REDIS_ADDON_PASSWORD` is correct
3. **Fallback mode**: Check Redis addon is properly configured

### Permission Issues
1. **Malformed route keys**: Check permission mapping debug logs
2. **Access denied**: Verify user roles and permissions
3. **Public route issues**: Check `publicRoutes` array in permission config

### Application Issues
1. **Startup failures**: Check application logs with `clever logs`
2. **Health check failures**: Verify `/health` endpoint is accessible
3. **Performance issues**: Monitor resource usage in Clever Cloud dashboard

## Prevention

### Pre-deployment Checklist
- [ ] All required environment variables are set
- [ ] Database and Redis addons are created
- [ ] Connection pool settings match addon limits
- [ ] Migration scripts are up to date
- [ ] Fix script is available for quick recovery

### Monitoring Setup
- [ ] Enable Clever Cloud monitoring
- [ ] Set up log aggregation
- [ ] Configure alerting for critical issues
- [ ] Regular backup verification

## Support

For additional support:
- [Clever Cloud Documentation](https://www.clever-cloud.com/doc/)
- [GitHub Issues](https://github.com/your-repo/issues)
- [Application Logs](https://console.clever-cloud.com/goto/app_23bc1a06-d77f-44cd-bf52-3ba2d30ca986/logs)