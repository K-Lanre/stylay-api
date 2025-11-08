'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Starting wishlist enhancement migration...');
      
      // Check if columns already exist before adding them
      const [wishlistItemsColumns] = await queryInterface.sequelize.query(
        'DESCRIBE wishlist_items',
        { transaction }
      );
      
      const [wishlistsColumns] = await queryInterface.sequelize.query(
        'DESCRIBE wishlists',
        { transaction }
      );
      
      const wishlistItemsColumnNames = wishlistItemsColumns.map(col => col.Field);
      const wishlistsColumnNames = wishlistsColumns.map(col => col.Field);
      
      console.log('📊 Current wishlist_items columns:', wishlistItemsColumnNames);
      console.log('📊 Current wishlists columns:', wishlistsColumnNames);
      
      // Add selected_variants JSON column to wishlist_items (only if it doesn't exist)
      if (!wishlistItemsColumnNames.includes('selected_variants')) {
        console.log('➕ Adding selected_variants column to wishlist_items...');
        await queryInterface.addColumn('wishlist_items', 'selected_variants', {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Array of selected variant objects with id, name, value, and additional_price (like cart system)'
        }, { transaction });
        console.log('✅ Successfully added selected_variants column to wishlist_items');
      } else {
        console.log('⚠️ selected_variants column already exists in wishlist_items - skipping');
      }
      
      // Add total_price column to wishlist_items (only if it doesn't exist)
      if (!wishlistItemsColumnNames.includes('total_price')) {
        console.log('➕ Adding total_price column to wishlist_items...');
        await queryInterface.addColumn('wishlist_items', 'total_price', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.00,
          comment: 'Total price including base price and variant additional prices'
        }, { transaction });
        console.log('✅ Successfully added total_price column to wishlist_items');
      } else {
        console.log('⚠️ total_price column already exists in wishlist_items - skipping');
      }
      
      // Add total_items column to wishlists (only if it doesn't exist)
      if (!wishlistsColumnNames.includes('total_items')) {
        console.log('➕ Adding total_items column to wishlists...');
        await queryInterface.addColumn('wishlists', 'total_items', {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: 'Total number of items in wishlist'
        }, { transaction });
        console.log('✅ Successfully added total_items column to wishlists');
      } else {
        console.log('⚠️ total_items column already exists in wishlists - skipping');
      }
      
      // Add total_amount column to wishlists (only if it doesn't exist)
      if (!wishlistsColumnNames.includes('total_amount')) {
        console.log('➕ Adding total_amount column to wishlists...');
        await queryInterface.addColumn('wishlists', 'total_amount', {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0.00,
          comment: 'Total amount of all items in wishlist'
        }, { transaction });
        console.log('✅ Successfully added total_amount column to wishlists');
      } else {
        console.log('⚠️ total_amount column already exists in wishlists - skipping');
      }

      // Compute total_price for existing wishlist items
      console.log('💰 Computing total_price for existing wishlist items...');
      const [updateResult] = await queryInterface.sequelize.query(`
        UPDATE wishlist_items 
        SET 
          total_price = COALESCE(price * quantity, 0)
        WHERE total_price = 0 OR total_price IS NULL
      `, { transaction });

      const affectedRows = updateResult.affectedRows || 0;
      console.log(`💰 Updated total_price for ${affectedRows} existing items`);

      // Compute aggregate totals for all wishlists
      console.log('📊 Computing aggregate totals for all wishlists...');
      const [wishlistUpdateResult] = await queryInterface.sequelize.query(`
        UPDATE wishlists w
        SET 
          total_items = (
            SELECT COALESCE(SUM(quantity), 0)
            FROM wishlist_items wi
            WHERE wi.wishlist_id = w.id
          ),
          total_amount = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM wishlist_items wi
            WHERE wi.wishlist_id = w.id
          )
      `, { transaction });

      const updatedWishlists = wishlistUpdateResult.affectedRows || 0;
      console.log(`📊 Updated totals for ${updatedWishlists} wishlists`);

      await transaction.commit();
      console.log('🎉 Wishlist enhancement migration completed successfully!');
      
      // Summary of what was accomplished
      console.log('\n📋 Migration Summary:');
      console.log(`   • Enhanced wishlist_items table with: selected_variants, total_price`);
      console.log(`   • Enhanced wishlists table with: total_items, total_amount`);
      console.log(`   • Computed totals for ${affectedRows} existing items`);
      console.log(`   • Updated aggregate totals for ${updatedWishlists} wishlists`);
      console.log('\n✨ The wishlist system now supports complex variants like the cart system!');
      
    } catch (error) {
      await transaction.rollback();
      
      // Provide specific error messages for common issues
      if (error.name === 'SequelizeDatabaseError' && error.message.includes('Duplicate column name')) {
        console.error('❌ Migration failed: Column already exists.');
        console.error('   This error should be handled gracefully by the column checking logic.');
        console.error('   If you see this error, the column existence check may have failed.');
      } else if (error.name === 'SequelizeDatabaseError' && error.message.includes('ER_NO_SUCH_TABLE')) {
        console.error('❌ Migration failed: One or more tables do not exist.');
        console.error('   Please ensure the database schema is up to date.');
      } else if (error.name === 'SequelizeDatabaseError' && error.message.includes('ER_ACCESS_DENIED_ERROR')) {
        console.error('❌ Migration failed: Database access denied.');
        console.error('   Please check database permissions and connection settings.');
      } else {
        console.error('❌ Migration failed with error:', error.message);
        console.error('   Error details:', error);
      }
      
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Rolling back wishlist enhancement migration...');
      
      // Check which columns exist before removing them
      const [wishlistsColumns] = await queryInterface.sequelize.query(
        'DESCRIBE wishlists',
        { transaction }
      );
      
      const [wishlistItemsColumns] = await queryInterface.sequelize.query(
        'DESCRIBE wishlist_items',
        { transaction }
      );
      
      const wishlistItemsColumnNames = wishlistItemsColumns.map(col => col.Field);
      const wishlistsColumnNames = wishlistsColumns.map(col => col.Field);
      
      // Remove columns only if they exist (to handle idempotent rollback)
      if (wishlistsColumnNames.includes('total_items')) {
        await queryInterface.removeColumn('wishlists', 'total_items', { transaction });
        console.log('✅ Removed total_items column from wishlists');
      } else {
        console.log('⚠️ total_items column does not exist in wishlists - skipping removal');
      }
      
      if (wishlistsColumnNames.includes('total_amount')) {
        await queryInterface.removeColumn('wishlists', 'total_amount', { transaction });
        console.log('✅ Removed total_amount column from wishlists');
      } else {
        console.log('⚠️ total_amount column does not exist in wishlists - skipping removal');
      }
      
      if (wishlistItemsColumnNames.includes('total_price')) {
        await queryInterface.removeColumn('wishlist_items', 'total_price', { transaction });
        console.log('✅ Removed total_price column from wishlist_items');
      } else {
        console.log('⚠️ total_price column does not exist in wishlist_items - skipping removal');
      }
      
      if (wishlistItemsColumnNames.includes('selected_variants')) {
        await queryInterface.removeColumn('wishlist_items', 'selected_variants', { transaction });
        console.log('✅ Removed selected_variants column from wishlist_items');
      } else {
        console.log('⚠️ selected_variants column does not exist in wishlist_items - skipping removal');
      }
      
      await transaction.commit();
      console.log('✅ Wishlist enhancement migration rollback completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration rollback failed:', error.message);
      
      // Specific error handling for rollback
      if (error.name === 'SequelizeDatabaseError' && error.message.includes('ER_ACCESS_DENIED_ERROR')) {
        console.error('   Error: Database access denied during rollback.');
      } else {
        console.error('   Error details:', error);
      }
      
      throw error;
    }
  }
};