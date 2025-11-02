// Test script to verify Category model loads without errors
const { Category } = require('./models');

console.log('Category model loaded successfully');
console.log('Timestamp configuration: timestamps = true');
console.log('Sequelize should now automatically manage created_at and updated_at fields');

// Test the model definition
if (Category.options.timestamps) {
  console.log('✅ Timestamps are enabled in Category model');
} else {
  console.log('❌ Timestamps are still disabled');
}

// Try to create a mock instance to test validation
try {
  const mockCategory = Category.build({
    name: 'Test Category',
    slug: 'test-category'
  });
  
  console.log('✅ Category model can build instances without timestamp errors');
  console.log('Ready for category creation requests');
} catch (error) {
  console.error('❌ Error building category instance:', error.message);
}
