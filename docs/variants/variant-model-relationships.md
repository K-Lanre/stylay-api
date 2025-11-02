# Model Relationships Documentation

## Overview

This document outlines the relationships between Sequelize models in the Stylay API, including the new variant system models introduced in the `add-variant-types` change.

## Core Models

### User Model
- **Relationships:**
  - `hasMany`: Orders, Addresses, Carts, Wishlists, Reviews, Notifications
  - `belongsTo`: Role (through UserRole)
  - `belongsToMany`: Vendors (through VendorFollowers)

### Product Model
- **Relationships:**
  - `belongsTo`: Category, Vendor (Store)
  - `hasMany`: ProductImages, ProductVariants, Reviews, VariantCombinations
  - `belongsToMany`: Collections (through CollectionProducts)
  - `belongsToMany`: Tags (through VendorProductTags)

### Order Model
- **Relationships:**
  - `belongsTo`: User
  - `hasMany`: OrderItems, OrderDetails, PaymentTransactions, Payouts
  - `belongsTo`: Address (billing/shipping)

## Variant System Models

### VariantType Model
- **Purpose:** Defines categories of product variations (Size, Color, Material, etc.)
- **Relationships:**
  - `hasMany`: VariantCombinationVariants (junction table)
  - `belongsToMany`: VariantCombinations (through VariantCombinationVariants)

### VariantCombination Model
- **Purpose:** Represents specific combinations of variant values for products
- **Relationships:**
  - `belongsTo`: Product
  - `hasMany`: VariantCombinationVariants (junction table)
  - `belongsToMany`: VariantTypes (through VariantCombinationVariants)
  - `hasMany`: Inventory (through product-variant relationship)

### VariantCombinationVariant Model (Junction)
- **Purpose:** Links variant combinations to specific variant type values
- **Relationships:**
  - `belongsTo`: VariantCombination
  - `belongsTo`: VariantType

## Legacy Variant Models

### ProductVariant Model
- **Purpose:** Original variant model (being phased out)
- **Relationships:**
  - `belongsTo`: Product
  - `hasOne`: Inventory
  - `hasMany`: OrderItems (selected variants)

## Inventory & Supply Chain

### Inventory Model
- **Relationships:**
  - `belongsTo`: ProductVariant (legacy) OR VariantCombination (new)
  - `belongsTo`: Supply
  - `hasMany`: InventoryHistory

### Supply Model
- **Relationships:**
  - `belongsTo`: Vendor
  - `belongsTo`: ProductVariant (legacy) OR VariantCombination (new)
  - `belongsTo`: VendorProductTag
  - `hasMany`: Inventory

## E-commerce Flow Models

### Cart & CartItem Models
- **Cart Relationships:**
  - `belongsTo`: User
  - `hasMany`: CartItems
- **CartItem Relationships:**
  - `belongsTo`: Cart, Product
  - `belongsTo`: ProductVariant (legacy) OR VariantCombination (new)

### OrderItem Model
- **Relationships:**
  - `belongsTo`: Order, Product
  - `belongsTo`: ProductVariant (legacy) OR VariantCombination (new)

## Administrative Models

### Role & Permission Models
- **Role Relationships:**
  - `hasMany`: Users (through UserRole)
  - `belongsToMany`: Permissions (through RolePermissions)
- **Permission Relationships:**
  - `belongsToMany`: Roles (through RolePermissions)

### Vendor Model
- **Relationships:**
  - `belongsTo`: User (owner)
  - `hasMany`: Products, Supplies, Payouts
  - `belongsToMany`: Users (followers through VendorFollowers)

## Notification System

### Notification & NotificationItem Models
- **Notification Relationships:**
  - `belongsTo`: User
  - `hasMany`: NotificationItems
- **NotificationItem Relationships:**
  - `belongsTo`: Notification
  - `belongsTo`: Order (optional, for order-related notifications)

## Complete Entity Relationship Diagram

```
User
├── Orders (1:N)
├── Addresses (1:N)
├── Carts (1:N)
├── Wishlists (1:N)
├── Reviews (1:N)
├── Notifications (1:N)
├── Role (N:1 through UserRole)
└── VendorFollowers (N:M with Vendor)

Product
├── Category (N:1)
├── Vendor/Store (N:1)
├── ProductImages (1:N)
├── ProductVariants (legacy) (1:N)
├── VariantCombinations (new) (1:N)
├── Reviews (1:N)
├── Collections (N:M through CollectionProducts)
└── Tags (N:M through VendorProductTags)

VariantType
├── VariantCombinationVariants (1:N)
└── VariantCombinations (N:M through VariantCombinationVariants)

VariantCombination
├── Product (N:1)
├── VariantCombinationVariants (1:N)
├── VariantTypes (N:M through VariantCombinationVariants)
└── Inventory (1:N)

VariantCombinationVariant (Junction)
├── VariantCombination (N:1)
└── VariantType (N:1)

Order
├── User (N:1)
├── OrderItems (1:N)
├── OrderDetails (1:N)
├── PaymentTransactions (1:N)
├── Payouts (1:N)
└── Address (N:1)

CartItem
├── Cart (N:1)
├── Product (N:1)
└── ProductVariant/VariantCombination (N:1)

Inventory
├── ProductVariant/VariantCombination (N:1)
├── Supply (N:1)
└── InventoryHistory (1:N)

Vendor
├── User (owner) (N:1)
├── Products (1:N)
├── Supplies (1:N)
├── Payouts (1:N)
└── Followers (N:M with User through VendorFollowers)
```

## Migration Notes

### From Legacy to New Variant System

**Before (Legacy System):**
```
Product → ProductVariant → Inventory
```

**After (New System):**
```
Product → VariantCombination ← VariantCombinationVariant → VariantType
                    ↓
                Inventory
```

### Key Changes
1. **VariantType**: Centralized variant categories (Size, Color, etc.)
2. **VariantCombination**: Specific product variations with stock/pricing
3. **Junction Table**: Flexible many-to-many relationships between combinations and types
4. **Backward Compatibility**: Legacy ProductVariant still supported during transition

### Foreign Key Updates
- `inventory.variant_combination_id` (new foreign key)
- `variant_combination_variants.variant_type_id` (new)
- `variant_combination_variants.variant_combination_id` (new)
- `product_variants.variant_type_id` (added for migration)

## Indexing Strategy

### Performance Indexes
- `variant_combinations.product_id` (frequently queried)
- `variant_combinations.sku` (unique constraint)
- `variant_combination_variants.variant_combination_id, variant_type_id` (composite)
- `inventory.variant_combination_id` (foreign key)

### Query Optimization
- Eager loading for product-variant relationships
- Batch operations for bulk combination creation
- Cached variant data for frequently accessed products

## Validation Rules

### Required Relationships
- VariantCombination must belong to a Product
- VariantCombinationVariant must link to both Combination and Type
- Inventory must reference either ProductVariant OR VariantCombination (not both)

### Cascade Deletes
- Deleting a Product cascades to VariantCombinations
- Deleting a VariantCombination cascades to VariantCombinationVariants
- Deleting a VariantType requires checking for existing combinations

### Unique Constraints
- VariantType names must be unique
- Combination SKUs must be unique per product
- Junction table prevents duplicate type-value combinations per product