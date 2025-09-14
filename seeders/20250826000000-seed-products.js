'use strict';
const { default: axios } = require('axios');
const { faker } = require('@faker-js/faker/locale/en_NG');
const slugify = require('slugify');

// Configure faker to use the new API paths
const {
  number: { int: randomNumber },
  helpers: { arrayElement },
  string: { uuid },
  date: { past },
  datatype: { boolean }
} = faker;

// Helper function to generate a slug from a string
const generateSlug = (name) => {
  return slugify(name, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
};

// Generate product variants
const generateVariants = (productId) => {
  const variants = [];
  const variantTypes = [
    { name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Color', values: ['Red', 'Blue', 'Black', 'White', 'Green', 'Yellow'] },
    { name: 'Material', values: ['Cotton', 'Polyester', 'Wool', 'Silk', 'Leather'] }
  ];

  // Only generate variants for valid product IDs (positive numbers)
  if (productId <= 0) {
    return variants;
  }

  const selectedType = arrayElement(variantTypes);

  for (const value of selectedType.values) {
    variants.push({
      product_id: productId,
      name: selectedType.name,
      value: value,
      additional_price: randomNumber({ min: 0, max: 50, precision: 0.01 }),
      stock: randomNumber({ min: 0, max: 100 }),
      created_at: new Date()
    });
  }
  
  return variants;
};

// Generate product images
const generateImages = (productId, imageUrls, isFeatured = false) => {
  // Only generate images for valid product IDs (positive numbers)
  if (productId <= 0) {
    return [];
  }
  
  return imageUrls.map((url, index) => ({
    product_id: productId,
    image_url: url,
    is_featured: isFeatured && index === 0,
    created_at: new Date(),
  }));
};

// Generate a random product
const generateProduct = (vendorIds, categoryIds, realProduct, index) => {
  const name = realProduct.title;
  const slug = `${generateSlug(name)}-${uuid().substring(0, 8)}`;
  const price = parseFloat(realProduct.price);
  const hasDiscount = boolean({ probability: 0.3 }); // 30% chance of having a discount
  const discountPercentage = hasDiscount ? randomNumber({ min: 5, max: 50 }) : 0;
  const discountedPrice = hasDiscount ? (price * (100 - discountPercentage) / 100).toFixed(2) : null;

  return {
    name: name,
    slug: slug,
    description: realProduct.description,
    price: price,
    discounted_price: discountedPrice,
    sku: `SKU-${Date.now()}-${index}`,
    status: arrayElement(['active', 'inactive', 'apology']),
    vendor_id: arrayElement(vendorIds),
    category_id: arrayElement(categoryIds),
    thumbnail: realProduct.images[0],
    created_at: past(365), // Random date in the past year
  };
};

// Fetch products from the Fake Store API
const fetchRealProducts = async (limit = 100) => {
  try {
    const response = await axios.get(`https://api.escuelajs.co/api/v1/products?offset=0&limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching real products:', error);
    return [];
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get all vendor IDs
    const vendors = await queryInterface.sequelize.query(
      'SELECT id FROM vendors WHERE status = "approved"',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (vendors.length === 0) {
      console.log('No approved vendors found. Please run vendor seeder first.');
      return;
    }

    const vendorIds = vendors.map(v => v.id);

    // Get all category IDs
    const categories = await queryInterface.sequelize.query(
      'SELECT id FROM categories WHERE parent_id IS NOT NULL', // Only get subcategories
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (categories.length === 0) {
      console.log('No categories found. Please run category seeder first.');
      return;
    }

    const categoryIds = categories.map(c => c.id);

    // Fetch real products from the API
    const realProducts = await fetchRealProducts(100);
    if (realProducts.length === 0) {
      console.log('Could not fetch real products. Seeding aborted.');
      return;
    }

    // Generate products
    const products = [];
    const productVariants = [];
    const productImages = [];

    for (let i = 0; i < realProducts.length; i++) {
      const product = generateProduct(vendorIds, categoryIds, realProducts[i], i);
      products.push(product);
    }

    // Insert products in batches to avoid timeouts
    const BATCH_SIZE = 20;
    const insertedProductIds = [];

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      await queryInterface.bulkInsert('products', batch);

      // Get the last inserted ID and calculate the range for this batch
      const [results] = await queryInterface.sequelize.query(
        'SELECT LAST_INSERT_ID() as lastId',
        { type: queryInterface.sequelize.QueryTypes.SELECT }
      );

      const lastId = results.lastId;
      const startId = lastId - batch.length + 1;

      // Generate IDs for this batch
      for (let j = 0; j < batch.length; j++) {
        const productId = startId + j;
        insertedProductIds.push(productId);

        const variants = generateVariants(productId);
        productVariants.push(...variants);

        const images = generateImages(productId, realProducts[i + j].images, true);
        productImages.push(...images);

        // Set the first image as thumbnail
        if (images.length > 0) {
          await queryInterface.sequelize.query(
            'UPDATE products SET thumbnail = ? WHERE id = ?',
            {
              replacements: [images[0].image_url, productId],
              type: queryInterface.sequelize.QueryTypes.UPDATE
            }
          );
        }
      }
    }

    // Insert variants and images
    if (productVariants.length > 0) {
      await queryInterface.bulkInsert('product_variants', productVariants);
    }

    if (productImages.length > 0) {
      await queryInterface.bulkInsert('product_images', productImages);
    }

    console.log(`Seeded ${insertedProductIds.length} products with ${productVariants.length} variants and ${productImages.length} images`);
  },

  async down(queryInterface, Sequelize) {
    // Delete all products (cascading will delete variants and images)
    await queryInterface.bulkDelete('products', null, {});

    // Also explicitly delete from variants and images tables in case cascade doesn't work
    await queryInterface.bulkDelete('product_variants', null, {});
    await queryInterface.bulkDelete('product_images', null, {});
  }
};