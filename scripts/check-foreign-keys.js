const { sequelize } = require('../models');

async function checkForeignKeys() {
  try {
    console.log('=== Checking Foreign Key Constraints ===\n');
    
    // Test database connection first
    await sequelize.authenticate();
    console.log('✓ Database connection successful\n');
    
    // Check all foreign key constraints on order_items table
    const [constraints] = await sequelize.query(`
      SELECT
        CONSTRAINT_NAME,
        CONSTRAINT_TYPE,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME,
        DELETE_RULE,
        UPDATE_RULE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_NAME = 'order_items'
        AND kcu.CONSTRAINT_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.COLUMN_NAME;
    `);
    
    console.log('Foreign Key Constraints on order_items:');
    console.log('=====================================');
    if (constraints.length === 0) {
      console.log('No foreign key constraints found on order_items table');
    } else {
      constraints.forEach(constraint => {
        console.log(`Constraint Name: ${constraint.CONSTRAINT_NAME}`);
        console.log(`Column: ${constraint.COLUMN_NAME}`);
        console.log(`References: ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
        console.log(`Delete Rule: ${constraint.DELETE_RULE || 'NO ACTION'}`);
        console.log(`Update Rule: ${constraint.UPDATE_RULE || 'CASCADE'}`);
        console.log('---');
      });
    }
    
    // Check the product_id column definition
    const [columns] = await sequelize.query(`
      SELECT 
        COLUMN_NAME,
        IS_NULLABLE,
        DATA_TYPE,
        COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'order_items'
        AND COLUMN_NAME = 'product_id'
        AND TABLE_SCHEMA = DATABASE();
    `);
    
    console.log('\nProduct_id Column Definition:');
    console.log('=============================');
    if (columns.length > 0) {
      const col = columns[0];
      console.log(`Column Name: ${col.COLUMN_NAME}`);
      console.log(`Is Nullable: ${col.IS_NULLABLE}`);
      console.log(`Data Type: ${col.DATA_TYPE}`);
      console.log(`Column Type: ${col.COLUMN_TYPE}`);
    } else {
      console.log('product_id column not found');
    }
    
    // Check if there are any orphaned records with NULL product_id
    const [orphanedCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM order_items WHERE product_id IS NULL;
    `);
    
    console.log('\nOrphaned Records:');
    console.log('=================');
    console.log(`Records with NULL product_id: ${orphanedCount[0].count}`);
    
    // Check total order items
    const [totalCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM order_items;
    `);
    
    console.log(`Total order items: ${totalCount[0].count}`);
    
  } catch (error) {
    console.error('Error checking foreign keys:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkForeignKeys();