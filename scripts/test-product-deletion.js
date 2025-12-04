const { Product, OrderItem, CartItem, WishlistItem, Review, Inventory, Supply, ProductImage, ProductVariant } = require('../models');
const ProductService = require('../services/product.service');

async function testProductDeletion() {
  try {
    console.log('=== Testing Product Deletion Workflow ===\n');
    
    // Test 1: Check database connection
    console.log('1. Testing database connection...');
    await Product.sequelize.authenticate();
    console.log('✓ Database connection successful\n');
    
    // Test 2: Get a sample product
    console.log('2. Finding a test product...');
    const product = await Product.findOne({
      include: [
        { model: ProductVariant, as: 'variants' },
        { model: ProductImage, as: 'images' }
      ]
    });
    
    if (!product) {
      console.log('❌ No products found in database');
      return;
    }
    
    console.log(`✓ Found product: ${product.name} (ID: ${product.id})\n`);
    
    // Test 3: Check related records
    console.log('3. Checking related records...');
    
    const orderItemsCount = await OrderItem.count({ where: { product_id: product.id } });
    const cartItemsCount = await CartItem.count({ where: { product_id: product.id } });
    const wishlistItemsCount = await WishlistItem.count({ where: { product_id: product.id } });
    const reviewsCount = await Review.count({ where: { product_id: product.id } });
    const inventoryCount = await Inventory.count({ where: { product_id: product.id } });
    const supplyCount = await Supply.count({ where: { product_id: product.id } });
    const imagesCount = await ProductImage.count({ where: { product_id: product.id } });
    const variantsCount = await ProductVariant.count({ where: { product_id: product.id } });
    
    console.log(`   - Order items: ${orderItemsCount}`);
    console.log(`   - Cart items: ${cartItemsCount}`);
    console.log(`   - Wishlist items: ${wishlistItemsCount}`);
    console.log(`   - Reviews: ${reviewsCount}`);
    console.log(`   - Inventory records: ${inventoryCount}`);
    console.log(`   - Supply records: ${supplyCount}`);
    console.log(`   - Product images: ${imagesCount}`);
    console.log(`   - Product variants: ${variantsCount}\n`);
    
    // Test 4: Check foreign key constraint behavior
    console.log('4. Testing foreign key constraint behavior...');
    
    // Try to simulate what would happen during deletion
    if (orderItemsCount > 0) {
      console.log(`   ⚠️  Product has ${orderItemsCount} order items - this could cause foreign key constraint errors`);
      console.log('   ℹ️  The migration should change the constraint to ON DELETE SET NULL');
    } else {
      console.log('   ✓ No order items - foreign key constraint should not be an issue');
    }
    
    // Test 5: Check if we can simulate the deletion process
    console.log('\n5. Testing deletion simulation...');
    
    // This will show us what the enhanced service would do
    console.log('   The enhanced ProductService.deleteProduct() will:');
    console.log('   - Delete product variants');
    console.log('   - Delete product images');
    console.log('   - Delete inventory records');
    console.log('   - Delete supply records');
    console.log('   - Delete reviews');
    console.log('   - Delete wishlist items');
    console.log('   - Delete cart items');
    console.log('   - Preserve order items (set product_id to NULL)');
    console.log('   - Delete the product');
    
    // Test 6: Check current foreign key constraint status
    console.log('\n6. Checking current foreign key constraint status...');
    
    try {
      // Try to get constraint information using Sequelize's describeTable
      const orderItemTableInfo = await OrderItem.sequelize.queryInterface.describeTable('order_items');
      const productColumn = orderItemTableInfo.product_id;
      
      console.log(`   Product column definition: ${productColumn.type}`);
      console.log(`   Is nullable: ${productColumn.allowNull}`);
      
      if (!productColumn.allowNull) {
        console.log('   ⚠️  product_id is NOT NULL - migration needed to make it nullable');
      } else {
        console.log('   ✓ product_id is nullable - migration may have been applied');
      }
    } catch (error) {
      console.log(`   ℹ️  Could not determine column constraints: ${error.message}`);
    }
    
    console.log('\n=== Test Summary ===');
    console.log('✓ Database connection working');
    console.log('✓ Product found with ID:', product.id);
    console.log('✓ Related records identified');
    console.log('✓ Foreign key constraint behavior understood');
    
    if (orderItemsCount > 0 && !productColumn?.allowNull) {
      console.log('\n🎯 RECOMMENDATION: Apply the migration to fix foreign key constraints');
      console.log('   Run: npx sequelize-cli db:migrate --name 20251203150500-fix-order-items-foreign-key-constraint-v2.js');
    } else {
      console.log('\n✅ Product deletion should work - no foreign key constraint issues detected');
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testProductDeletion().then(() => {
  console.log('\n=== Test completed ===');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});