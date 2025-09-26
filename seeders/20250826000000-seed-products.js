'use strict';
const { default: axios } = require('axios');
const { faker } = require('@faker-js/faker/locale/en_US');
const slugify = require('slugify');

// Base URL for product images
const BASE_IMAGE_URL = 'https://picsum.photos/800/1000?random=';

// Configure faker
const {
  number: { int: randomNumber },
  helpers: { arrayElement },
  commerce: { productName, productDescription, productMaterial, productAdjective },
  image: { fashion },
  datatype: { boolean, float },
  lorem: { sentence, sentences, paragraph, paragraphs },
  date: { past, between },
  person: { firstName, lastName } // Updated from faker.name
} = faker;

// Helper function to generate a slug from a string
const generateSlug = (name) => {
  return slugify(name, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
};

// Real brand names for different categories
const BRANDS = {
  't-shirts': ['Nike', 'Adidas', 'Puma', 'H&M', 'Zara', 'Uniqlo', 'Levis', 'Tommy Hilfiger'],
  'shorts': ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok', 'Champion', 'Fila'],
  'skirts': ['Zara', 'H&M', 'Mango', 'Forever 21', 'ASOS', 'Topshop', 'Bershka'],
  'hoodies': ['Champion', 'Nike', 'Adidas', 'The North Face', 'Puma', 'Calvin Klein', 'Tommy Hilfiger'],
  'jeans': ['Levis', 'Wrangler', 'Diesel', 'Calvin Klein', 'Lee', 'Guess', 'True Religion']
};

// Real product data for different categories
const CATEGORY_PRODUCTS = {
  't-shirts': [
    'Classic Fit T-Shirt', 'Slim Fit T-Shirt', 'V-Neck T-Shirt', 'Polo Shirt', 'Graphic T-Shirt',
    'Long Sleeve T-Shirt', 'Pocket T-Shirt', 'Henley T-Shirt', 'Ringer T-Shirt', 'Muscle Fit T-Shirt'
  ],
  'shorts': [
    'Athletic Shorts', 'Cargo Shorts', 'Chino Shorts', 'Denim Shorts', 'Linen Shorts',
    'Running Shorts', 'Swim Trunks', 'Basketball Shorts', 'Cargo Jogger Shorts', 'Tailored Shorts'
  ],
  'skirts': [
    'Midi Skirt', 'Mini Skirt', 'Maxi Skirt', 'Pleated Skirt', 'Denim Skirt',
    'Pencil Skirt', 'A-line Skirt', 'Wrap Skirt', 'Skater Skirt', 'Tulle Skirt'
  ],
  'hoodies': [
    'Pullover Hoodie', 'Zip-Up Hoodie', 'Oversized Hoodie', 'Fleece Hoodie', 'Athletic Hoodie',
    'Graphic Hoodie', 'Sweatshirt Hoodie', 'Cropped Hoodie', 'Sherpa Hoodie', 'Hooded Jacket'
  ],
  'jeans': [
    'Slim Fit Jeans', 'Skinny Jeans', 'Straight Leg Jeans', 'Bootcut Jeans', 'Relaxed Fit Jeans',
    'Tapered Jeans', 'High Waist Jeans', 'Mom Jeans', 'Boyfriend Jeans', 'Flared Jeans'
  ]
};

// Real product descriptions for different categories
const PRODUCT_DESCRIPTIONS = {
  't-shirts': [
    'Made from 100% premium cotton for ultimate comfort and breathability.',
    'Soft and lightweight fabric that keeps you cool all day long.',
    'Classic fit that never goes out of style, perfect for any casual occasion.',
    'Reinforced stitching for enhanced durability and long-lasting wear.',
    'Eco-friendly materials that are gentle on your skin and the environment.'
  ],
  'shorts': [
    'Ideal for both workouts and casual wear with moisture-wicking technology.',
    'Designed for maximum comfort and flexibility during any activity.',
    'Lightweight and breathable fabric that keeps you cool in warm weather.',
    'Multiple pockets provide ample storage for your essentials on the go.',
    'Elastic waistband with drawstring for a customizable, secure fit.'
  ],
  'skirts': [
    'Flattering silhouette that complements any body type beautifully.',
    'Versatile design that transitions seamlessly from day to night.',
    'Flowy fabric that moves with you for ultimate comfort and style.',
    'Classic design with modern details for a timeless look.',
    'Perfect length for both casual outings and special occasions.'
  ],
  'hoodies': [
    'Plush fleece interior for exceptional warmth and comfort.',
    'Adjustable drawstring hood for a customized fit and extra coziness.',
    'Kangaroo pocket provides storage and keeps hands warm.',
    'Ribbed cuffs and hem for a snug, comfortable fit that locks in heat.',
    'Durable construction designed to maintain shape and softness wash after wash.'
  ],
  'jeans': [
    'Premium denim with just the right amount of stretch for all-day comfort.',
    'Classic five-pocket design with reinforced stitching for durability.',
    'Mid-rise waist with a flattering fit that looks great on everyone.',
    'Distressed details for a trendy, lived-in look that never goes out of style.',
    'Designed to maintain color and shape even after multiple washes.'
  ]
};

// Generate realistic product variants based on category
const generateVariants = (productId, category) => {
  const variants = [];
  
  // Define variant types based on category
  const variantTypes = {
    't-shirts': {
      'Size': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      'Color': ['Black', 'White', 'Navy', 'Gray', 'Red', 'Royal Blue', 'Forest Green', 'Mustard'],
      'Fit': ['Slim', 'Regular', 'Oversized', 'Relaxed']
    },
    'shorts': {
      'Size': ['28', '30', '32', '34', '36', '38'],
      'Color': ['Black', 'Navy', 'Khaki', 'Olive', 'Charcoal', 'Light Blue'],
      'Length': ['5\" Inseam', '7\" Inseam', '9\" Inseam', '11\" Inseam']
    },
    'skirts': {
      'Size': ['XS', 'S', 'M', 'L', 'XL'],
      'Color': ['Black', 'Navy', 'Beige', 'Pink', 'Red', 'Floral Print', 'Striped'],
      'Pattern': ['Solid', 'Striped', 'Floral', 'Plaid', 'Polka Dot']
    },
    'hoodies': {
      'Size': ['S', 'M', 'L', 'XL', 'XXL'],
      'Color': ['Black', 'Charcoal', 'Navy', 'Burgundy', 'Olive', 'Heather Gray'],
      'Style': ['Pullover', 'Zip-Up']
    },
    'jeans': {
      'Waist': ['28', '30', '32', '34', '36', '38'],
      'Length': ['30"', '32"', '34"', '36"'],
      'Wash': ['Light Wash', 'Medium Wash', 'Dark Wash', 'Black', 'White']
    }
  };

  // Get the appropriate variant types for this category
  const categoryVariants = variantTypes[category] || variantTypes['t-shirts'];
  
  // Only generate variants for valid product IDs (positive numbers)
  if (productId <= 0) {
    return variants;
  }

  // Generate size variants (always included)
  const sizes = categoryVariants['Size'] || categoryVariants['Waist'] || ['One Size'];
  for (const size of sizes) {
    variants.push({
      product_id: productId,
      name: 'Size',
      value: size,
      additional_price: 0,
      stock: randomNumber({ min: 5, max: 100 }),
      created_at: new Date()
    });
  }

  // Generate color variants (if applicable)
  if (categoryVariants['Color']) {
    const colors = categoryVariants['Color'];
    for (const color of colors) {
      variants.push({
        product_id: productId,
        name: 'Color',
        value: color,
        additional_price: randomNumber({ min: 0, max: 20, precision: 0.01 }),
        stock: randomNumber({ min: 0, max: 50 }),
        created_at: new Date()
      });
    }
  }

  // Add one more variant type if available
  const additionalVariant = Object.keys(categoryVariants).find(
    key => !['Size', 'Color', 'Waist', 'Length'].includes(key)
  );
  
  if (additionalVariant) {
    const values = categoryVariants[additionalVariant];
    for (const value of values) {
      variants.push({
        product_id: productId,
        name: additionalVariant,
        value: value,
        additional_price: randomNumber({ min: 0, max: 30, precision: 0.01 }),
        stock: randomNumber({ min: 0, max: 30 }),
        created_at: new Date()
      });
    }
  }
  
  return variants;
};

// Generate product images with different angles and styles
const generateImages = (productId, productName, category, isFeatured = false) => {
  const images = [];
  
  // Define search terms based on category
  const searchTerms = {
    't-shirts': ['t-shirt', 'plain tshirt', 'casual top', 'cotton shirt'],
    'shorts': ['shorts', 'casual shorts', 'summer shorts', 'athletic shorts'],
    'skirts': ['skirt', 'summer skirt', 'casual skirt', 'floral skirt'],
    'hoodies': ['hoodie', 'sweatshirt', 'pullover', 'zip hoodie'],
    'jeans': ['jeans', 'denim', 'skinny jeans', 'slim fit jeans']
  };

  const terms = searchTerms[category] || ['fashion'];
  const searchTerm = encodeURIComponent(terms[Math.floor(Math.random() * terms.length)]);
  
  // Generate 3-5 images per product with different angles
  const imageCount = randomNumber({ min: 3, max: 5 });
  
  for (let i = 0; i < imageCount; i++) {
    const imageUrl = `${BASE_IMAGE_URL}${productId}${i}`;
    images.push({
      product_id: productId,
      image_url: imageUrl,
      is_featured: i === 0 ? 1 : 0, // First image is featured
      created_at: new Date()
    });
  }
  
  return images;
};

// Generate a realistic product based on category
const generateProduct = (vendorIds, categoryInfo, index) => {
  const vendorId = arrayElement(vendorIds);
  const { id: categoryId, name: categoryName, slug: categorySlug } = categoryInfo;
  
  // Extract subcategory from slug (e.g., 'men-t-shirts' -> 't-shirts')
  const subcategory = categorySlug.split('-').slice(1).join('-');
  
  // Generate product name and details based on category
  const brand = arrayElement(BRANDS[subcategory] || ['Generic']);
  const productType = arrayElement(CATEGORY_PRODUCTS[subcategory] || ['Product']);
  const productName = `${brand} ${productType}`;
  
  // Generate realistic pricing based on category
  const basePrice = getBasePrice(subcategory);
  const price = parseFloat((basePrice * (0.8 + Math.random() * 0.6)).toFixed(2)); // 80-140% of base price
  const hasDiscount = Math.random() > 0.7; // 30% chance of having a discount
  const discountPercentage = hasDiscount ? randomNumber({ min: 10, max: 40 }) : 0;
  const salePrice = hasDiscount ? parseFloat((price * (1 - discountPercentage / 100)).toFixed(2)) : null;
  
  // Generate detailed description
  const description = generateProductDescription(productName, brand, subcategory);
  
  // Generate specifications
  const specifications = generateSpecifications(subcategory);
  
  return {
    name: productName,
    slug: generateSlug(productName) + '-' + randomNumber({ min: 1000, max: 9999 }),
    description: description,
    thumbnail: null, // Initialize as null, will be set after images are generated
    price: price,
    discounted_price: salePrice,
    sku: `${brand.substring(0, 3).toUpperCase()}${subcategory.substring(0, 3).toUpperCase()}${randomNumber({ min: 1000, max: 9999 })}`,
    status: 'active',
    vendor_id: vendorId,
    category_id: categoryId,
    created_at: past(365),
    updated_at: new Date()
  };
};

// Helper function to generate base price based on subcategory
function getBasePrice(subcategory) {
  const priceRanges = {
    't-shirts': { min: 15, max: 50 },
    'shorts': { min: 20, max: 70 },
    'skirts': { min: 25, max: 90 },
    'hoodies': { min: 30, max: 120 },
    'jeans': { min: 40, max: 150 }
  };
  
  const range = priceRanges[subcategory] || { min: 10, max: 100 };
  return randomNumber(range);
}

// Generate detailed product description
function generateProductDescription(name, brand, subcategory) {
  const descriptions = PRODUCT_DESCRIPTIONS[subcategory] || [
    'High-quality product designed for comfort and style.',
    'Versatile piece that can be dressed up or down for any occasion.',
    'Made with premium materials for lasting durability.',
    'Perfect addition to your wardrobe for year-round wear.',
    'Designed with attention to detail and modern aesthetics.'
  ];
  
  const features = [
    'Breathable fabric for all-day comfort',
    'Easy care and machine washable',
    'Reinforced stitching for durability',
    'Classic design that never goes out of style',
    'Perfect fit for any body type'
  ];
  
  // Shuffle and take 2-3 features
  const selectedFeatures = features
    .sort(() => 0.5 - Math.random())
    .slice(0, randomNumber({ min: 2, max: 4 }));
  
  const description = arrayElement(descriptions);
  const featureList = selectedFeatures.map(f => `• ${f}`).join('\n');
  
  return `${name} by ${brand}. ${description}\n\nFeatures:\n${featureList}\n\nAvailable in multiple sizes and colors.`;
}

// Generate product specifications
function generateSpecifications(subcategory) {
  const baseSpecs = {
    'Material': '100% Premium Cotton',
    'Care Instructions': 'Machine wash cold, tumble dry low',
    'Origin': 'Imported',
    'Closure': 'Pull On',
    'Fit Type': arrayElement(['Regular', 'Slim', 'Relaxed', 'Oversized']),
    'Season': arrayElement(['All Season', 'Spring', 'Summer', 'Fall', 'Winter']),
    'Style': arrayElement(['Casual', 'Athletic', 'Fashion', 'Basic', 'Designer'])
  };
  
  const specificSpecs = {
    't-shirts': {
      'Sleeve Type': arrayElement(['Short Sleeve', 'Long Sleeve', 'Sleeveless']),
      'Neckline': arrayElement(['Crew Neck', 'V-Neck', 'Polo', 'Henley']),
      'Fabric Type': arrayElement(['Jersey', 'Pima Cotton', 'Organic Cotton', 'Tri-Blend'])
    },
    'shorts': {
      'Pockets': arrayElement(['2 Side Pockets', '4-Way Stretch', 'Zippered Pockets']),
      'Closure Type': arrayElement(['Elastic Waist', 'Drawstring', 'Button & Zipper']),
      'Inseam': arrayElement([`${randomNumber({ min: 5, max: 11 })} inch`, 'Mid-thigh', 'Above knee'])
    },
    'skirts': {
      'Length': arrayElement(['Mini', 'Knee-Length', 'Midi', 'Maxi']),
      'Waist Type': arrayElement(['High Waist', 'Mid Rise', 'Elastic Waist']),
      'Pattern': arrayElement(['Solid', 'Printed', 'Striped', 'Floral', 'Plaid'])
    },
    'hoodies': {
      'Hood Type': arrayElement(['Classic Hood', 'Adjustable Drawstring', 'Kangaroo Pocket']),
      'Sleeve Type': arrayElement(['Raglan Sleeves', 'Set-In Sleeves', 'Drop Shoulder']),
      'Lining': arrayElement(['Fleece', 'French Terry', 'Jersey', 'Sherpa'])
    },
    'jeans': {
      'Fit': arrayElement(['Slim', 'Skinny', 'Straight', 'Bootcut', 'Relaxed']),
      'Rise': arrayElement(['High Rise', 'Mid Rise', 'Low Rise']),
      'Wash': arrayElement(['Light Wash', 'Medium Wash', 'Dark Wash', 'Black', 'White'])
    }
  };
  
  return {
    ...baseSpecs,
    ...(specificSpecs[subcategory] || {})
  };
}

// Fetch real product data from a more reliable source
async function fetchRealProducts(limit = 100) {
  // In a real implementation, you would fetch from a real e-commerce API
  // For now, we'll generate realistic product data programmatically
  return [];
};

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get all approved vendors
    const vendors = await queryInterface.sequelize.query(
      'SELECT id FROM vendors WHERE status = "approved"',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (vendors.length === 0) {
      console.log('No approved vendors found. Please seed vendors first.');
      return;
    }

    // Get all categories for product assignment
    const allCategories = await queryInterface.sequelize.query(
      `SELECT id, name, slug, parent_id FROM categories`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!allCategories || allCategories.length === 0) {
      throw new Error('No categories found in the database. Please ensure the category seeder has been run.');
    }

    const subCategories = allCategories.filter(cat => cat.parent_id !== null);
    const vendorIds = vendors.map(v => v.id);

    // Generate 150 products per vendor (total: 100 vendors × 150 products = 15,000 products)
    const productsPerVendor = 150;
    let totalProducts = 0;
    let totalVariants = 0;
    let totalImages = 0;
    const usedSlugs = new Set();

    for (const vendor of vendors) {
      for (let i = 0; i < productsPerVendor; i++) {
        // Randomly select a category for this product
        const randomCategory = arrayElement(subCategories);
        const simpleSubCategorySlug = randomCategory.slug.split('-').pop();

        // Generate product data
        let product = generateProduct(vendorIds, randomCategory, totalProducts + 1);
        let productVariants = generateVariants(999999, simpleSubCategorySlug); // Temporary ID
        let productImages = generateImages(999999, product.name, simpleSubCategorySlug, i === 0);

        // Ensure slug uniqueness
        let slugCounter = 1;
        let originalSlug = product.slug;
        while (usedSlugs.has(product.slug)) {
          product.slug = originalSlug.replace(/-\d+$/, '') + '-' + randomNumber({ min: 1000, max: 9999 }) + '-' + slugCounter;
          slugCounter++;
        }
        usedSlugs.add(product.slug);

        // Set thumbnail from first image
        if (productImages.length > 0) {
          product.thumbnail = productImages[0].image_url;
        }

        // Insert product
        await queryInterface.bulkInsert('products', [product]);

        // Get the actual product ID
        const lastProduct = await queryInterface.sequelize.query(
          'SELECT id FROM products ORDER BY id DESC LIMIT 1',
          { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        const actualProductId = lastProduct[0].id;

        // Update variants and images with correct product ID
        const updatedVariants = productVariants.map(variant => ({
          ...variant,
          product_id: actualProductId
        }));

        const updatedImages = productImages.map(image => ({
          ...image,
          product_id: actualProductId,
          image_url: image.image_url.replace('999999', actualProductId.toString())
        }));

        // Insert variants and images
        if (updatedVariants.length > 0) {
          await queryInterface.bulkInsert('product_variants', updatedVariants);
          totalVariants += updatedVariants.length;
        }

        if (updatedImages.length > 0) {
          await queryInterface.bulkInsert('product_images', updatedImages);
          totalImages += updatedImages.length;
        }

        totalProducts++;
        console.log(`Inserted product ${totalProducts} for vendor ${vendor.id} with ${updatedVariants.length} variants and ${updatedImages.length} images`);
      }
    }

    console.log(`Seeded ${totalProducts} products with ${totalVariants} variants and ${totalImages} images`);
  },

  async down(queryInterface, Sequelize) {
    // Delete all products (cascading will delete variants and images)
    await queryInterface.bulkDelete('products', null, {});

    // Also explicitly delete from variants and images tables in case cascade doesn't work
    await queryInterface.bulkDelete('product_variants', null, {});
    await queryInterface.bulkDelete('product_images', null, {});
  }
};
