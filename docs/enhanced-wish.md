# Enhanced Wishlist API Documentation

## Overview
The wishlist system has been enhanced to support complex variant handling similar to the cart system, while maintaining backward compatibility with existing single variant functionality.

## Key Enhancements

### New Features
- **Multiple Variants Support**: Items can now have multiple variants (e.g., Color + Size + Material)
- **Automatic Total Calculations**: Real-time calculation of item totals and wishlist aggregates
- **Backward Compatibility**: Existing `variant_id` parameter still works and is auto-converted
- **Enhanced Pricing**: Supports base price + variant additional prices

### New Fields Added
- `selected_variants`: Array of variant objects with `id`, `name`, `value`, `additional_price`
- `total_price`: Calculated total for each item (base price + variants × quantity)
- `total_items` & `total_amount`: Aggregate wishlist totals

## API Endpoints

### POST `/api/v1/wishlists/:id/items`
Add item to wishlist with enhanced variant support.

**Request Body (New Format - Multiple Variants):**
```json
{
  "product_id": 123,
  "selected_variants": [
    {
      "id": 456,
      "name": "Color",
      "value": "Red",
      "additional_price": 5.00
    },
    {
      "id": 789,
      "name": "Size", 
      "value": "L",
      "additional_price": 0.00
    }
  ],
  "quantity": 2,
  "notes": "Birthday gift",
  "priority": "high"
}
```

**Request Body (Legacy Format - Single Variant):**
```json
{
  "product_id": 123,
  "variant_id": 456,
  "quantity": 1,
  "priority": "medium"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Item added to wishlist successfully",
  "data": {
    "id": 999,
    "product_id": 123,
    "selected_variants": [
      {
        "id": 456,
        "name": "Color",
        "value": "Red", 
        "additional_price": 5.00
      }
    ],
    "variant_id": 456,
    "quantity": 1,
    "price": 29.99,
    "total_price": 34.99,
    "notes": "Birthday gift",
    "priority": "high",
    "added_at": "2025-11-08T19:38:00.000Z",
    "product": {
      "id": 123,
      "name": "T-Shirt",
      "price": 29.99,
      "status": "active"
    }
  }
}
```

### GET `/api/v1/wishlists/:id`
Get wishlist with calculated totals.

**Response includes new fields:**
```json
{
  "status": "success",
  "data": {
    "id": 888,
    "user_id": 123,
    "name": "My Wishlist",
    "total_items": 5,
    "total_amount": 249.95,
    "items": [...]
  }
}
```

### GET `/api/v1/wishlists/:id/items`
Get wishlist items with enhanced variant information.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `priority`: Filter by priority (low, medium, high)
- `sort`: Sort order (added_at, priority, price)

**Response includes new fields:**
```json
{
  "status": "success",
  "results": 2,
  "data": [
    {
      "id": 999,
      "selected_variants": [...],
      "variant_id": 456,
      "quantity": 2,
      "price": 29.99,
      "total_price": 69.98,
      "priority": "high",
      "notes": "Birthday gift",
      "product": {...}
    }
  ]
}
```

### PUT `/api/v1/wishlists/:id/items/:itemId`
Update wishlist item quantity, notes, or priority.

**Request Body:**
```json
{
  "quantity": 3,
  "notes": "Updated notes",
  "priority": "medium"
}
```

**Response includes recalculated totals:**
```json
{
  "status": "success",
  "message": "Wishlist item updated successfully",
  "data": {
    "id": 999,
    "quantity": 3,
    "total_price": 104.97,
    // ... other fields
  }
}
```

### DELETE `/api/v1/wishlists/:id/items/:itemId`
Remove item from wishlist (wishlist totals are automatically updated).

## Backward Compatibility

### Legacy Support
- **Single variant_id**: Automatically converted to `selected_variants` array
- **Existing responses**: Include new fields while preserving old structure
- **No breaking changes**: All existing API calls continue to work

### Migration Path
1. **Phase 1**: Existing `variant_id` calls automatically use new system
2. **Phase 2**: Clients can migrate to `selected_variants` for multiple variants
3. **Phase 3**: Legacy `variant_id` can be deprecated in future versions

## Pricing Calculation

### Formula
```
total_price = (base_price + sum(variant.additional_price)) × quantity
```

### Example
- Product price: $29.99
- Color variant (Red): +$5.00
- Size variant (L): +$0.00
- Quantity: 2
- **Total: ($29.99 + $5.00 + $0.00) × 2 = $69.98**

## Error Handling

### Validation Errors
- Invalid variant ID: `400 - Variant {id} not found for product`
- Duplicate variants: `400 - Duplicate variant ID in selected_variants`
- Product unavailable: `400 - Product is not available`

### Existing Errors
- `404 - Wishlist not found`
- `404 - Item not found in wishlist`
- `403 - Access denied`

## Database Changes

### New Columns Added
- `wishlist_items.selected_variants` (JSON)
- `wishlist_items.total_price` (DECIMAL)
- `wishlists.total_items` (INTEGER)
- `wishlists.total_amount` (DECIMAL)

### Migration
Run the migration script: `npx sequelize-cli db:migrate`

## Testing

### Test Coverage
- Multiple variant combinations
- Backward compatibility with single variant
- Price calculation accuracy
- Total aggregation
- CRUD operations
- Error handling

### Run Tests
```bash
npm test test/enhanced-wishlist.test.js
```

## Performance Considerations

### Optimizations
- **Efficient Queries**: Uses proper indexes for variant lookups
- **Real-time Updates**: Database hooks automatically update totals
- **Minimal Overhead**: Backward compatibility adds minimal performance impact

### Best Practices
- Use `selected_variants` for new integrations
- Cache wishlist responses when possible
- Validate variants before API calls to reduce errors

## Examples

### JavaScript/Node.js
```javascript
// Add item with multiple variants
const response = await fetch('/api/v1/wishlists/123/items', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    product_id: 456,
    selected_variants: [
      { id: 789, name: 'Color', value: 'Blue', additional_price: 10.00 },
      { id: 790, name: 'Size', value: 'XL', additional_price: 5.00 }
    ],
    quantity: 1
  })
});

const data = await response.json();
```

### cURL
```bash
# Add item with multiple variants
curl -X POST http://localhost:3000/api/v1/wishlists/123/items \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 456,
    "selected_variants": [
      {
        "id": 789,
        "name": "Color", 
        "value": "Blue",
        "additional_price": 10.00
      }
    ],
    "quantity": 1
  }'