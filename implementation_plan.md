# Implementation Plan

## Overview
This plan outlines the refactoring of the existing wishlist system into a simplified "mini wishlist" functionality. The goal is to provide a minimalist user experience where products can be added to and removed from a user's single wishlist, without complex features like variant selection, quantity management, notes, priority, or additional analytical/management endpoints. The price of the product at the time of addition will be stored.

The current implementation is overly complex for the desired "mini wishlist" concept, involving extensive data models, controllers, validators, and documentation for features that will no longer be supported. This refactoring will significantly reduce the codebase, simplify database schema, and streamline API endpoints.

## Types
The type system changes will focus on simplifying the `Wishlist` and `WishlistItem` models.

**Simplified `Wishlist` Model:**
```typescript
interface Wishlist {
  id: number;
  user_id: number;
  created_at: Date;
  updated_at: Date;
}
```
*   `id`: Primary key, auto-incrementing.
*   `user_id`: Foreign key referencing the `User` model, ensuring each user has a unique wishlist.
*   `created_at`: Timestamp for creation.
*   `updated_at`: Timestamp for last update.

**Simplified `WishlistItem` Model:**
```typescript
interface WishlistItem {
  id: number;
  wishlist_id: number;
  product_id: number;
  price_at_addition: number; // Stored price at the time of adding to wishlist
  added_at: Date;
  created_at: Date;
  updated_at: Date;
}
```
*   `id`: Primary key, auto-incrementing.
*   `wishlist_id`: Foreign key referencing the `Wishlist` model.
*   `product_id`: Foreign key referencing the `Product` model.
*   `price_at_addition`: Decimal, stores the price of the product when it was added to the wishlist.
*   `added_at`: Timestamp for when the item was added to the wishlist.
*   `created_at`: Timestamp for creation.
*   `updated_at`: Timestamp for last update.

## Files
File modifications will involve deleting and modifying several existing files.

**New files to be created:**
*   None.

**Existing files to be modified:**
*   `routes/wishlist.route.js`: Drastically simplify, remove all routes except `GET /` (get wishlist) and `POST /items` (add item) and `DELETE /items/:itemId` (remove item).
*   `validators/wishlist.validator.js`: Simplify `addItemValidation` to only validate `product_id`. Remove `updateItemValidation`, `getWishlistItemsValidation`, `moveToCartValidation`. Keep `wishlistItemIdValidation`.
*   `controllers/wishlist.controller.js`: Drastically simplify. Remove all functions except `getOrCreateUserWishlist`, `getUserWishlist`, `addItemToWishlist`, and `removeItemFromWishlist`. `addItemToWishlist` and `getUserWishlist` will be simplified to handle only `product_id` and implicit quantity of 1, and `price_at_addition`.
*   `models/wishlist.model.js`: Remove `name`, `description`, `is_public`, `is_default`, `total_items`, `total_amount` columns and all related instance methods (`calculateTotals`, `updateTotals`, `getItemCount`, `getFullDetails`, `isOwnedBy`, `addItem`, `removeItem`, `makePublic`, `makePrivate`). Keep `associate` and the model definition. The `is_default` field and associated unique index might be retained to ensure a single wishlist per user, but its purpose will shift from identifying a "default" among many to simply being a flag for the *sole* wishlist.
*   `models/wishlist-item.model.js`: Remove `variant_id`, `selected_variants`, `quantity`, `total_price`, `notes`, `priority` columns and all related instance methods (`calculateTotalPrice`, `calculateVariantPrice`, `updateTotalPrice`, `getVariantDetails`, `getFullDetails`, `checkAvailability`, `updatePrice`, `getCurrentPrice`, `moveToWishlist`, `convertFromLegacyVariant`). Replace `price` with `price_at_addition`. Simplify `associate` and model definition.
*   `migrations/20250923143500-create-wishlists.js`: Modify to reflect the simplified `Wishlist` schema.
*   `migrations/20250923143600-create-wishlist-items.js`: Modify to reflect the simplified `WishlistItem` schema.
*   `test/enhanced-wishlist.test.js`: This test file likely tests the complex features. It should be removed or entirely rewritten to test the simplified wishlist functionality. For this plan, we will assume it should be removed entirely, and new basic tests created if needed (not part of this plan).

**Files to be deleted:**
*   `docs/enhanced-wish.md`: Obsolete documentation.
*   `docs/single-wishlist-api.md`: Obsolete documentation.
*   `scripts/convert-legacy-wishlist-data.js`: Obsolete script due to removal of variant handling.
*   `test/enhanced-wishlist.test.js` (or fully rewritten).

**Configuration file updates:**
*   None initially, but may need to update `package.json` if dependencies are removed/added.

## Functions
Function modifications will focus on streamlining core wishlist operations and removing peripheral logic.

**New functions:**
*   None.

**Modified functions:**
*   `getOrCreateUserWishlist` (in `controllers/wishlist.controller.js`): Simplify the creation of the default wishlist by removing `name`, `description`, `is_public` properties. It will just create a basic wishlist with `user_id`.
*   `getUserWishlist` (in `controllers/wishlist.controller.js`): Simplify the data fetched. It should only retrieve the wishlist and its items with `product_id` and `price_at_addition`. Remove all includes for variants, detailed product info, and user details in the item array. Product details (name, thumbnail, current price) should be dynamically fetched using a simpler `Product` model include.
*   `addItemToWishlist` (in `controllers/wishlist.controller.js`):
    *   Remove `variant_id`, `selected_variants`, `quantity`, `notes`, `priority` from request body processing.
    *   Set `quantity` implicitly to 1.
    *   Store `product.price` as `price_at_addition`.
    *   Remove all variant validation and logic.
    *   Simplify `existingItem` check to only `wishlist_id` and `product_id`.
    *   Simplify `item.update` and `WishlistItem.create` to only use `wishlist_id`, `product_id`, and `price_at_addition`.
    *   Remove `item.getFullDetails()` call at the end, returning a simpler response.
*   `removeItemFromWishlist` (in `controllers/wishlist.controller.js`): No significant change needed, as it only relies on `itemId` and `wishlist_id`.

**Removed functions:**
*   `updateWishlistItem` (in `controllers/wishlist.controller.js`)
*   `getWishlistItems` (in `controllers/wishlist.controller.js`)
*   `getWishlistSummary` (in `controllers/wishlist.controller.js`)
*   `clearWishlist` (in `controllers/wishlist.controller.js`)
*   `getWishlistStats` (in `controllers/wishlist.controller.js`)
*   `getWishlistAnalytics` (in `controllers/wishlist.controller.js`)
*   `moveToCart` (in `controllers/wishlist.controller.js`)
*   `calculateTotals`, `updateTotals`, `getItemCount`, `getFullDetails`, `isOwnedBy`, `addItem`, `removeItem`, `makePublic`, `makePrivate` (from `models/wishlist.model.js`)
*   `calculateTotalPrice`, `calculateVariantPrice`, `updateTotalPrice`, `getVariantDetails`, `getFullDetails`, `checkAvailability`, `updatePrice`, `getCurrentPrice`, `moveToWishlist`, `convertFromLegacyVariant` (from `models/wishlist-item.model.js`)
*   `addItemValidation`, `updateItemValidation`, `getWishlistItemsValidation`, `moveToCartValidation`, `validateWishlistItemOwnership` (from `validators/wishlist.validator.js` - some parts of `addItemValidation` will be rewritten).

## Classes
Class modifications will primarily involve simplifying the data models.

**New classes:**
*   None.

**Modified classes:**
*   `Wishlist` (in `models/wishlist.model.js`): As described in the Types section, remove fields and methods.
*   `WishlistItem` (in `models/wishlist-item.model.js`): As described in the Types section, remove fields and methods, and change `price` to `price_at_addition`.

**Removed classes:**
*   None.

## Dependencies
Dependency modifications will be minimal, primarily removing unused imports.

**New packages:**
*   None.

**Version changes:**
*   None.

**Integration requirements:**
*   Remove unused `ProductVariant` import from `controllers/wishlist.controller.js` and `models/wishlist-item.model.js`.
*   Remove unused `Cart` and `CartItem` imports from `controllers/wishlist.controller.js`.
*   Update imports in `validators/wishlist.validator.js` to reflect removed validation functions.

## Testing
The testing approach will involve removing outdated tests and relying on manual verification for the core functionality.

**Test file requirements:**
*   Delete `test/enhanced-wishlist.test.js`.
*   New tests should be created for the simplified `addItemToWishlist` and `removeItemFromWishlist` routes, and `getUserWishlist`. These new tests are not included in this plan.

**Existing test modifications:**
*   All existing tests related to wishlist functionality are expected to be removed or fail due to the significant simplification.

**Validation strategies:**
*   Manual testing of the `POST /api/v1/wishlist/items` endpoint with `product_id` to ensure successful addition.
*   Manual testing of the `DELETE /api/v1/wishlist/items/:itemId` endpoint to ensure successful removal.
*   Manual testing of the `GET /api/v1/wishlist` endpoint to ensure the correct wishlist and its items (with `price_at_addition`) are returned.

## Implementation Order
The implementation sequence will prioritize database schema changes, followed by model, validator, controller, and route updates, and finally documentation and script removal.

1.  **Modify `migrations/20250923143500-create-wishlists.js`**: Update schema to remove `name`, `description`, `is_public`, `is_default`, `total_items`, `total_amount`. (Retain `is_default` and its index, but only for enforcing one wishlist per user, not for actual "default" selection among many).
2.  **Modify `migrations/20250923143600-create-wishlist-items.js`**: Update schema to remove `variant_id`, `selected_variants`, `quantity`, `total_price`, `notes`, `priority`. Rename `price` to `price_at_addition`.
3.  **Run Migrations**: Execute `npx sequelize-cli db:migrate` (this will require careful handling if data exists, possibly a new migration to alter tables rather than modifying existing create migrations directly). For this plan, we assume direct modification and re-running migrations on a dev environment.
4.  **Modify `models/wishlist.model.js`**: Remove all unnecessary fields and instance methods (`calculateTotals`, `updateTotals`, `getItemCount`, `getFullDetails`, `isOwnedBy`, `addItem`, `removeItem`, `makePublic`, `makePrivate`).
5.  **Modify `models/wishlist-item.model.js`**: Remove all unnecessary fields and instance methods (`calculateTotalPrice`, `calculateVariantPrice`, `updateTotalPrice`, `getVariantDetails`, `getFullDetails`, `checkAvailability`, `updatePrice`, `getCurrentPrice`, `moveToWishlist`, `convertFromLegacyVariant`). Rename `price` to `price_at_addition`.
6.  **Modify `validators/wishlist.validator.js`**: Simplify `addItemValidation` to only validate `product_id`. Remove `updateItemValidation`, `getWishlistItemsValidation`, `moveToCartValidation`. Retain and adjust `wishlistItemIdValidation` if necessary.
7.  **Modify `controllers/wishlist.controller.js`**:
    *   Remove all functions except `getOrCreateUserWishlist`, `getUserWishlist`, `addItemToWishlist`, `removeItemFromWishlist`.
    *   Simplify `getOrCreateUserWishlist` (remove `name`, `description`, `is_public`).
    *   Simplify `getUserWishlist` (remove complex includes, return only wishlist and basic item details).
    *   Simplify `addItemToWishlist` (only `product_id`, implicit `quantity=1`, store `product.price` as `price_at_addition`, remove variant logic).
8.  **Modify `routes/wishlist.route.js`**: Remove all routes except `GET /`, `POST /items`, and `DELETE /items/:itemId`. Update validation middleware accordingly.
9.  **Clean up Imports**: Remove unused imports from `controllers/wishlist.controller.js`, `models/wishlist.model.js`, `models/wishlist-item.model.js`, and `validators/wishlist.validator.js`.
10. **Delete `docs/enhanced-wish.md` and `docs/single-wishlist-api.md`**: Remove obsolete documentation.
11. **Delete `scripts/convert-legacy-wishlist-data.js`**: Remove obsolete script.
12. **Delete `test/enhanced-wishlist.test.js`**: Remove outdated test file.
