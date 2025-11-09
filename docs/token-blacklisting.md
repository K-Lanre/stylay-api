# Token Blacklisting Implementation

This implementation adds token blacklisting to your authentication system to prevent the reuse of JWT tokens after logout.

## How It Works

### 1. Token Blacklisting Service (`services/token-blacklist.service.js`)
- Uses Redis to store blacklisted tokens with their remaining TTL
- Hashes tokens for secure storage
- Automatically expires blacklist entries when tokens expire
- Provides methods to blacklist tokens and check if tokens are blacklisted

### 2. Updated Logout Function
- Now extracts the JWT token from the Authorization header
- Adds the token to the blacklist with its remaining TTL
- Ensures the token cannot be used after logout

### 3. Updated Authentication Middleware
- Checks if tokens are blacklisted before allowing access
- Returns appropriate error message for blacklisted tokens
- Maintains backward compatibility with existing routes

## Key Features

✅ **Minimal Implementation**: Only adds necessary functionality
✅ **Redis Integration**: Uses your existing Redis setup with fallback
✅ **Automatic Cleanup**: Blacklist entries expire automatically
✅ **Secure**: Tokens are hashed before storage
✅ **Backward Compatible**: Existing routes work without changes

## Usage

### User Logout
```javascript
// Client sends logout request with token
POST /api/v1/auth/logout
Authorization: Bearer <jwt_token>

// Server response
{
  "status": "success",
  "message": "Successfully logged out"
}

// Token is now blacklisted and cannot be used
```

### Protected Routes
```javascript
// Any protected route now automatically checks blacklist
GET /api/v1/auth/me
Authorization: Bearer <jwt_token>

// If token is blacklisted, returns:
{
  "status": "error",
  "message": "Token has been invalidated. Please log in again."
}
```

## Testing

Run the tests to verify functionality:
```bash
npm test test/token-blacklist.test.js
```

## Environment Variables

Make sure you have these environment variables set:
```env
JWT_SECRET=your-jwt-secret
REDIS_HOST=localhost (optional, defaults to localhost)
REDIS_PORT=6379 (optional, defaults to 6379)
REDIS_ENABLED=true (optional, defaults to true)
```

## Security Considerations

1. **Token Hashing**: Tokens are hashed with JWT_SECRET before storage
2. **TTL Management**: Blacklist entries expire with the token
3. **Graceful Fallback**: Works even if Redis is unavailable
4. **Minimal Attack Surface**: Only stores necessary token data

## Troubleshooting

### Redis Not Available
- The system will use fallback implementations
- Blacklisting won't work but authentication continues
- Check Redis connection in logs

### Token Not Blacklisted
- Verify JWT_SECRET is set
- Check Redis connection
- Ensure Authorization header format is correct

### Performance
- Redis lookups are O(1) for optimal performance
- Minimal impact on response times
- Automatic cleanup prevents memory bloat