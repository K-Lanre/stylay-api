# Variant System API Documentation

## Overview

The Stylay API now supports a comprehensive variant system that allows products to have multiple variant types (like Size, Color, Material) with combinations that represent specific product variations. This system replaces the simple variant approach with a more flexible and scalable structure.

## Key Concepts

### Variant Types
- **Definition**: Categories of variations (e.g., Size, Color, Material)
- **Structure**: Each variant type has multiple values (e.g., Size: Small, Medium, Large)
- **Usage**: Products can have multiple variant types

### Variant Combinations
- **Definition**: Specific combinations of variant values that represent actual product variations
- **Structure**: Junction between products and their variant values
- **Inventory**: Each combination can have its own stock level and pricing

## API Endpoints

### Variant Types Management

#### GET /api/variants/types
Retrieve all variant types.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Size",
      "values": ["Small", "Medium", "Large"],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/variants/types
Create a new variant type.

**Request:**
```json
{
  "name": "Color",
  "values": ["Red", "Blue", "Green"]
}
```

#### PUT /api/variants/types/:id
Update a variant type.

#### DELETE /api/variants/types/:id
Delete a variant type.

### Variant Combinations Management

#### GET /api/variants/combinations/:productId
Get all combinations for a specific product.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "productId": 123,
      "combination": {
        "Size": "Medium",
        "Color": "Blue"
      },
      "sku": "PROD-MED-BLU",
      "price": 29.99,
      "stock": 50,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/variants/combinations
Create a new variant combination.

**Request:**
```json
{
  "productId": 123,
  "variants": {
    "Size": "Medium",
    "Color": "Blue"
  },
  "sku": "PROD-MED-BLU",
  "price": 29.99,
  "stock": 50
}
```

#### PUT /api/variants/combinations/:id
Update a variant combination.

#### DELETE /api/variants/combinations/:id
Delete a variant combination.

### Product Integration

#### POST /api/products
Create a product with variant types.

**Request:**
```json
{
  "name": "T-Shirt",
  "description": "Comfortable cotton t-shirt",
  "basePrice": 19.99,
  "variantTypes": [
    {
      "name": "Size",
      "values": ["Small", "Medium", "Large"]
    },
    {
      "name": "Color",
      "values": ["Red", "Blue", "Green"]
    }
  ]
}
```

#### GET /api/products/:id
Retrieve product with variant information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "T-Shirt",
    "description": "Comfortable cotton t-shirt",
    "basePrice": 19.99,
    "variantTypes": [
      {
        "id": 1,
        "name": "Size",
        "values": ["Small", "Medium", "Large"]
      }
    ],
    "combinations": [
      {
        "id": 1,
        "combination": {"Size": "Medium"},
        "sku": "TSHIRT-MED",
        "price": 19.99,
        "stock": 100
      }
    ]
  }
}
```

## Database Schema

### Tables

#### variant_types
- `id` (Primary Key)
- `name` (String, unique)
- `values` (JSON array)
- `createdAt`, `updatedAt`

#### variant_combinations
- `id` (Primary Key)
- `productId` (Foreign Key to products)
- `combination` (JSON object)
- `sku` (String, unique)
- `price` (Decimal)
- `stock` (Integer)
- `createdAt`, `updatedAt`

#### variant_combination_variants (Junction)
- `id` (Primary Key)
- `variantCombinationId` (Foreign Key)
- `variantTypeId` (Foreign Key)
- `value` (String)

## Migration Notes

### From Old System
The previous system used a simple `product_variants` table. The new system:
- Separates variant types from combinations
- Supports multiple variant types per product
- Enables complex combination generation
- Provides better inventory management

### Backward Compatibility
- Existing products without variant types continue to work
- Old variant data is migrated to the new structure
- API responses include both old and new formats during transition

## Error Handling

### Common Error Codes
- `400`: Invalid variant type or combination data
- `404`: Variant type or combination not found
- `409`: SKU already exists
- `422`: Validation error (missing required fields)

### Validation Rules
- Variant type names must be unique
- Combination SKUs must be unique per product
- Stock levels cannot be negative
- Prices must be positive numbers

## Performance Considerations

### Indexing
- Composite index on `variant_combinations(productId, sku)`
- Index on `variant_types(name)`
- Foreign key indexes on junction table

### Caching
- Variant combinations are cached for frequently accessed products
- Cache invalidation on stock/price updates

### Query Optimization
- Use eager loading for product-variant relationships
- Batch operations for bulk combination creation
- Pagination for large combination lists