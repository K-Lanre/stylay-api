# Recently Viewed Products API Documentation

## Overview

The Recently Viewed Products feature allows tracking of products that users have viewed, providing personalized shopping experiences and analytics. The system uses a hybrid Redis + MySQL architecture for optimal performance and data persistence.

## Features

- **Product View Tracking**: Automatically tracks when authenticated users view products
- **Fast Retrieval**: Redis caching for sub-millisecond access to recent views
- **Data Persistence**: MySQL backup for reliability and analytics
- **Configurable Limits**: Default 10 products per user (configurable)
- **GDPR Compliance**: Data retention policies, deletion, and anonymization
- **Analytics**: View statistics and most viewed products insights

## Database Schema

### User Product Views Table (`user_product_views`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT | Primary key, auto-increment |
| `user_id` | BIGINT | Foreign key to users table |
| `product_id` | BIGINT | Foreign key to products table |
| `session_id` | VARCHAR(255) | Session ID for guest users (nullable) |
| `viewed_at` | DATETIME | When the product was viewed |
| `ip_address` | VARCHAR(45) | User's IP address (nullable) |
| `user_agent` | TEXT | Browser user agent (nullable) |
| `device_type` | ENUM | Device type: 'desktop', 'mobile', 'tablet', 'unknown' |
| `referrer` | VARCHAR(500) | Referrer URL (nullable) |
| `created_at` | DATETIME | Record creation timestamp |
| `updated_at` | DATETIME | Record update timestamp |

## API Endpoints

### 1. Get Recently Viewed Products

**Endpoint**: `GET /api/v1/products/recent`

**Authentication**: Required (Bearer token)

**Query Parameters**:
- `limit` (optional): Number of products to return (default: 10, max: 50)

**Response**:
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 123,
      "name": "Wireless Headphones",
      "slug": "wireless-headphones",
      "description": "High-quality wireless headphones",
      "price": 99.99,
      "status": "active",
      "Category": {
        "id": 1,
        "name": "Electronics",
        "slug": "electronics"
      },
      "Vendor": {
        "id": 1,
        "business_name": "Tech Store",
        "store": {
          "business_name": "Tech Store"
        }
      },
      "images": [
        {
          "id": 1,
          "image_url": "https://example.com/image.jpg"
        }
      ],
      "viewed_at": "2024-11-08T20:30:00.000Z"
    }
  ]
}
```

**Example Request**:
```bash
curl -X GET "https://api.example.com/api/v1/products/recent?limit=5" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Example Response**:
```bash
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 123,
      "name": "Wireless Headphones",
      "slug": "wireless-headphones",
      "description": "High-quality wireless headphones",
      "price": 99.99,
      "status": "active",
      "Category": {"id": 1, "name": "Electronics", "slug": "electronics"},
      "Vendor": {"id": 1, "business_name": "Tech Store"},
      "images": [{"id": 1, "image_url": "https://example.com/image.jpg"}],
      "viewed_at": "2024-11-08T20:30:00.000Z"
    }
  ]
}
```

### 2. Clear Recently Viewed Products

**Endpoint**: `DELETE /api/v1/products/recent`

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "data": {
    "deletedCount": 15
  }
}
```

**Example Request**:
```bash
curl -X DELETE "https://api.example.com/api/v1/products/recent" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### 3. Get View Statistics

**Endpoint**: `GET /api/v1/products/recent/stats`

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "data": {
    "totalViews": 45,
    "uniqueProducts": 23,
    "lastViewDate": "2024-11-08T20:15:00.000Z"
  }
}
```

**Example Request**:
```bash
curl -X GET "https://api.example.com/api/v1/products/recent/stats" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### 4. Anonymize User Data (GDPR Compliance)

**Endpoint**: `PATCH /api/v1/products/recent/anonymize`

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "success": true,
  "data": {
    "anonymizedCount": 12
  }
}
```

**Example Request**:
```bash
curl -X PATCH "https://api.example.com/api/v1/products/recent/anonymize" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### 5. Product View Tracking (Automatic)

**Endpoint**: `GET /api/v1/products/:identifier`

**Authentication**: Optional (for tracking authenticated users)

**Note**: This endpoint automatically tracks product views for authenticated users. No additional action required.

## Service Layer

### RecentlyViewedService

The service handles all business logic for the recently viewed products feature:

```javascript
const recentlyViewedService = require('../services/recentlyViewed.service');

// Track a product view
await recentlyViewedService.trackView({
  userId: 123,
  productId: 456,
  metadata: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    referrer: 'https://google.com',
    deviceType: 'desktop'
  }
});

// Get recent views
const views = await recentlyViewedService.getRecentViews({
  userId: 123,
  limit: 10
});

// Clear views
const result = await recentlyViewedService.clearRecentViews({ userId: 123 });

// Get statistics
const stats = await recentlyViewedService.getViewStatistics({ userId: 123 });

// Anonymize data (GDPR)
const result = await recentlyViewedService.anonymizeUserData(123);

// Cleanup old views
const cleanup = await recentlyViewedService.cleanupOldViews(30); // 30 days
```

## Environment Configuration

Add these environment variables to your `.env` file:

```env
# Recently Viewed Products Configuration
RECENTLY_VIEWED_LIMIT=10
VIEW_DATA_RETENTION_DAYS=30

# Redis Configuration (if not already set)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Database Migration

Run the migration to create the required table:

```bash
npm run migrate
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- test/recentlyViewed.test.js
```

The tests cover:
- Product view tracking
- Recently viewed products retrieval
- View statistics
- Data clearing
- GDPR anonymization
- Authentication requirements
- Error handling

## Performance Considerations

1. **Redis Caching**: Recent views are cached in Redis for sub-millisecond access
2. **Database Fallback**: Falls back to MySQL when Redis is unavailable
3. **LRU Eviction**: Automatically maintains the configured limit per user
4. **Indexing**: Optimized database indexes for fast queries
5. **Async Operations**: View tracking is non-blocking

## GDPR Compliance

The system includes several features for GDPR compliance:

1. **Data Retention**: Automatic cleanup of old view data (configurable)
2. **Right to Erasure**: Complete deletion of user view history
3. **Data Anonymization**: Removal of personal identifiers while preserving analytics
4. **Transparency**: Users can view their data through the statistics endpoint

## Rate Limiting

- Recent views retrieval: 100 requests per hour per user
- View clearing: 10 requests per hour per user
- Data anonymization: 5 requests per hour per user

## Error Handling

Common error responses:

```json
{
  "success": false,
  "message": "Invalid limit parameter",
  "statusCode": 400
}
```

```json
{
  "success": false,
  "message": "Unauthorized",
  "statusCode": 401
}
```

```json
{
  "success": false,
  "message": "Service temporarily unavailable",
  "statusCode": 503
}
```

## Monitoring and Analytics

The service includes built-in monitoring:

1. **Redis Health**: Automatic failover to database
2. **Performance Metrics**: Track view tracking latency
3. **Usage Analytics**: Most viewed products endpoint
4. **Error Logging**: Comprehensive error tracking

## Integration Examples

### Frontend Integration

```javascript
// React Hook for Recent Views
import { useState, useEffect } from 'react';
import axios from 'axios';

export const useRecentViews = (limit = 10) => {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchViews = async () => {
      try {
        const response = await axios.get(`/api/v1/products/recent?limit=${limit}`);
        setViews(response.data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchViews();
  }, [limit]);

  return { views, loading, error, refetch: () => window.location.reload() };
};

// Component Usage
const RecentViews = () => {
  const { views, loading, error } = useRecentViews(5);

  if (loading) return <div>Loading recent views...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Recently Viewed</h3>
      <div className="product-grid">
        {views.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};
```

### Product Recommendation Integration

```javascript
// Get user's browsing history for recommendations
const getPersonalizedRecommendations = async (userId) => {
  const recentViews = await recentlyViewedService.getRecentViews({
    userId,
    limit: 20
  });

  // Get categories of recently viewed products
  const categories = recentViews.map(view => view.category_id);
  
  // Find products in similar categories
  const recommendations = await Product.findAll({
    where: {
      category_id: { [Op.in]: categories },
      status: 'active'
    },
    limit: 10
  });

  return recommendations;
};
```

## Security Considerations

1. **Authentication Required**: All endpoints require valid JWT tokens
2. **Data Isolation**: Users can only access their own view data
3. **Input Validation**: All parameters are validated
4. **Rate Limiting**: Prevents abuse and DoS attacks
5. **Audit Logging**: All data operations are logged

## Future Enhancements

1. **Machine Learning**: Product recommendation algorithms
2. **Real-time Updates**: WebSocket notifications
3. **Cross-device Sync**: Unified view history across devices
4. **Advanced Analytics**: User behavior insights
5. **A/B Testing**: View tracking for conversion optimization