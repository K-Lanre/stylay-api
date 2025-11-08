// scripts/convert-legacy-wishlist-data.js
// This script converts existing wishlist items with variant_id to the new selected_variants format

const { WishlistItem, ProductVariant } = require('../models');
const { Op } = require('sequelize');

async function convertLegacyWishlistData() {
  console.log('🔄 Starting conversion of legacy wishlist data...');
  
  try {
    // Find all wishlist items that have variant_id but no selected_variants
    const itemsToConvert = await WishlistItem.findAll({
      where: {
        variant_id: { [Op.ne]: null },
        [Op.or]: [
          { selected_variants: null },
          { selected_variants: { [Op.eq]: '[]' } },
          { selected_variants: { [Op.eq]: '' } }
        ]
      }
    });

    console.log(`📊 Found ${itemsToConvert.length} items to convert`);

    let convertedCount = 0;
    let errorCount = 0;

    for (const item of itemsToConvert) {
      try {
        await item.convertFromLegacyVariant();
        convertedCount++;
        
        if (convertedCount % 10 === 0) {
          console.log(`✅ Converted ${convertedCount} items...`);
        }
      } catch (error) {
        console.error(`❌ Error converting item ${item.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('🎉 Conversion completed!');
    console.log(`   ✅ Successfully converted: ${convertedCount} items`);
    console.log(`   ❌ Failed conversions: ${errorCount} items`);
    
    if (convertedCount > 0) {
      console.log('\n📈 Updated wishlist totals...');
      // This will trigger the hooks to update wishlist totals
      const { Wishlist } = require('../models');
      const allWishlists = await Wishlist.findAll();
      
      for (const wishlist of allWishlists) {
        await wishlist.updateTotals();
        console.log(`   Updated wishlist ${wishlist.id}: ${wishlist.total_items} items, $${wishlist.total_amount}`);
      }
    }
    
    return { convertedCount, errorCount };
    
  } catch (error) {
    console.error('💥 Conversion failed:', error);
    throw error;
  }
}

// Run the conversion if this script is executed directly
if (require.main === module) {
  convertLegacyWishlistData()
    .then((result) => {
      console.log('\n✨ Legacy data conversion completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Legacy data conversion failed:', error);
      process.exit(1);
    });
}

module.exports = { convertLegacyWishlistData };