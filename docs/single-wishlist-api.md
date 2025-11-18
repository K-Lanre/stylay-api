# Wishlist API - Single Wishlist System

## Overview

The Stylay wishlist system has been refactored from a multi-wishlist model to a **single automatic wishlist per user**, working similar to a shopping cart. Each authenticated user has one wishlist that is automatically created on first access.

## Key Features

- **Single Wishlist**: Each user has one automatic wishlist
- **Auto-Creation**: Wishlist is created automatically on first access
- **Enhanced Variant Support**: Support for multiple variants (cart-like functionality)
- **Backward Compatibility**: Legacy `variant_id` parameter still works
- **Comprehensive Analytics**: Real-time totals and summaries
- **Move to Cart**: Direct item transfer to shopping cart

## Base URL
```
POST /api/v1/wishlist/items
GET  /api/v1/wishlist/items
```

---

## Endpoints

### 1. Get User's Single Wishlist
**Get the user's wishlist with all items and analytics**

```
GET /api/v1/wishlist
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "user_id": 123,
    "name": "My Wishlist",
    "description": "My personal wishlist",
    "is_public": false,
    "is_default": true,
    "items": [
      {
        "id": 456,
        "quantity": 2,
        "price": 29.99,
        "total_price": 59.98,
        "selected_variants": [
          {
            "name": "Size",
            "id": 10,
            "value": "Medium",
            "additional_price": 0
          },
          {
            "name": "Color", 
            "id": 20,
            "value": "Blue",
            "additional_price": 5.00
          }
        ],
        "variant_id": null,
        "priority": "high",
        "notes": "Great for summer",
        "added_at": "2025-11-09T14:00:00Z",
        "product": {
          "id": 789,
          "name": "Summer T-Shirt",
          "slug": "summer-t-shirt",
          "thumbnail": "https://cdn.stylay.com/images/tshirt.jpg",
          "price": 29.99,
          "discounted_price": 24.99,
          "status": "active",
          "variants": [...]
        }
      }
    ],
    "user": {
      "id": 123,
      "first_name": "John",
      "last_name": "Doe"
    },
    "created_at": "2025-11-09T10:00:00Z",
    "updated_at": "2025-11-09T14:00:00Z"
  }
}
```

---

### 2. Get Wishlist Items
**Get items in user's wishlist with pagination and filtering**

```
GET /api/v1/wishlist/items
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `priority` (optional): Filter by priority (low, medium, high)
- `sort` (optional): Sort order (priority, price, added_at) - default: added_at

**Example:**
```
GET /api/v1/wishlist/items?page=1&limit=5&priority=high&sort=price
```

**Response (200 OK):**
```json
{
  "status": "success",
  "results": 3,
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 5,
    "pages": 3
  },
  "data": [
    {
      "id": 456,
      "quantity": 1,
      "price": 29.99,
      "total_price": 34.99,
      "selected_variants": [...],
      "variant_id": null,
      "priority": "high",
      "notes": "Great for summer",
      "added_at": "2025-11-09T14:00:00Z",
      "product": {...}
    }
  ]
}
```

---

### 3. Add Item to Wishlist
**Add a product to user's wishlist with optional variants**

```
POST /api/v1/wishlist/items
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

**New Format (Multiple Variants):**
```json
{
  "product_id": 789,
  "selected_variants": [
    {
      "id": 10,
      "name": "Size",
      "value": "Medium",
      "additional_price": 0
    },
    {
      "id": 20, 
      "name": "Color",
      "value": "Blue",
      "additional_price": 5.00
    }
  ],
  "quantity": 2,
  "notes": "Great for summer vacation",
  "priority": "high"
}
```

**Legacy Format (Single Variant):**
```json
{
  "product_id": 789,
  "variant_id": 10,
  "quantity": 2,
  "notes": "Great for summer vacation",
  "priority": "medium"
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Item added to wishlist successfully",
  "data": {
    "id": 456,
    "quantity": 2,
    "price": 29.99,
    "total_price": 69.98,
    "selected_variants": [...],
    "variant_id": null,
    "priority": "high",
    "notes": "Great for summer vacation",
    "added_at": "2025-11-09T14:21:00Z",
    "product": {...}
  }
}
```

**Automatic Price Calculation:**
- `total_price = quantity × (base_price + sum(selected_variants.additional_price))`
- If same product + variants already exist in wishlist, quantity is updated instead of creating duplicate

---

### 4. Update Wishlist Item
**Update quantity, notes, or priority of existing wishlist item**

```
PUT /api/v1/wishlist/items/{itemId}
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "quantity": 3,
  "notes": "Still interested in this product",
  "priority": "medium"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Wishlist item updated successfully",
  "data": {
    "id": 456,
    "quantity": 3,
    "price": 29.99,
    "total_price": 104.97,
    "selected_variants": [...],
    "variant_id": null,
    "priority": "medium",
    "notes": "Still interested in this product",
    "added_at": "2025-11-09T14:00:00Z",
    "product": {...}
  }
}
```

---

### 5. Remove Item from Wishlist
**Remove a specific item from user's wishlist**

```
DELETE /api/v1/wishlist/items/{itemId}
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Item removed from wishlist successfully"
}
```

---

### 6. Get Wishlist Summary
**Get analytics and summary of user's wishlist**

```
GET /api/v1/wishlist/summary
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "wishlist_id": 1,
    "wishlist_name": "My Wishlist",
    "total_items": 8,
    "total_quantity": 12,
    "total_amount": 347.50,
    "average_item_price": 43.44,
    "created_at": "2025-11-09T10:00:00Z",
    "updated_at": "2025-11-09T14:21:00Z"
  }
}
```

**Summary Fields:**
- `total_items`: Number of unique products
- `total_quantity`: Sum of all item quantities
- `total_amount`: Total value of all items
- `average_item_price`: Average price per unique item

---

### 7. Move Item to Cart
**Transfer item from wishlist to shopping cart**

```
POST /api/v1/wishlist/move-to-cart
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "wishlist_item_id": 456
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Item moved to cart successfully",
  "data": {
    "cart_id": 789,
    "moved_item_id": 456,
    "product_name": "Summer T-Shirt"
  }
}
```

**Behavior:**
- Creates or uses existing user cart
- If same product + variants exist in cart, quantity is updated
- Item is completely removed from wishlist

---

## Auto-Creation Behavior

**Automatic Wishlist Creation:**
- On first access to any wishlist endpoint, an automatic wishlist is created
- Name: "My Wishlist"
- Description: "My personal wishlist"
- Privacy: Private (not public)
- Default: True

**User Experience:**
- Users never need to create a wishlist manually
- First wishlist operation automatically creates the wishlist
- Seamless experience - users just start adding items

---

## Backward Compatibility

**Legacy Support:**
- Existing API calls with `variant_id` still work
- System automatically converts `variant_id` to `selected_variants` array
- No breaking changes for existing integrations

**Migration Path:**
- Old: `POST /wishlists/{id}/items` with `variant_id`
- New: `POST /wishlist/items` with `selected_variants`
- Both formats accepted in new system

---

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Product not available"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Item not found in wishlist"
}
```

### 500 Server Error
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

---

## Security & Permissions

**Authentication Required:** All wishlist endpoints require valid JWT token
**Public Access:** No special permissions required (unlike old system)
**User Isolation:** Users can only access their own wishlist data

---

## Performance & Optimization

**Database Optimizations:**
- Automatic wishlist creation cached per user
- Efficient variant price calculations
- Real-time total updates with database hooks

**Caching:**
- Wishlist data cached in Redis (if available)
- Automatic cache invalidation on updates
- User wishlist state synchronized across requests

---

## Data Models

### WishlistItem
```typescript
interface WishlistItem {
  id: number;
  quantity: number;
  price: number;
  total_price: number;
  selected_variants?: VariantSelection[];
  variant_id?: number; // Legacy field
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  added_at: Date;
  product: Product;
}

interface VariantSelection {
  name: string;
  id: number;
  value: string;
  additional_price: number;
}
```

### Wishlist
```typescript
interface Wishlist {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  is_public: boolean;
  is_default: boolean;
  items: WishlistItem[];
  user: User;
  created_at: Date;
  updated_at: Date;
}
```

---

## Testing Examples

**Test Auto-Creation:**
1. Authenticate user
2. Call `GET /api/v1/wishlist` (wishlist should be created)
3. Verify no errors and wishlist has default properties

**Test Variants:**
1. Add item with `selected_variants`
2. Add same item again - should update quantity
3. Verify total_price calculation is correct

**Test Move to Cart:**
1. Add item to wishlist
2. Call move-to-cart endpoint
3. Verify item removed from wishlist
4. Verify item exists in cart

---

## Migration Notes

**For Existing Multi-Wishlist Users:**
- First access will create a new single wishlist
- Existing data remains in database (not deleted)
- Implement migration script if needed to consolidate existing data

**API Deprecation:**
- Old multi-wishlist endpoints now return 404
- Encourage migration to new single-wishlist endpoints
- Document transition period and support timeline

---

*Last Updated: November 9, 2025*