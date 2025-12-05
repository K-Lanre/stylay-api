const { Product, ProductImage, sequelize } = require("../models");

async function testThumbnailGetter() {
  try {
    console.log("=== Testing Thumbnail Getter ===");

    // Test 1: Product with thumbnail
    console.log("\n1. Testing product with thumbnail...");
    const productWithThumbnail = await Product.findByPk(1, {
      include: [{ model: ProductImage, as: "images" }],
    });

    if (productWithThumbnail) {
      console.log("Product with thumbnail:", {
        id: productWithThumbnail.id,
        name: productWithThumbnail.name,
        thumbnail: productWithThumbnail.thumbnail,
        thumbnailUrl: productWithThumbnail.thumbnailUrl,
      });
    } else {
      console.log("No product found with ID 1");
    }

    // Test 2: Product without thumbnail (should use first image)
    console.log("\n2. Testing product without thumbnail...");
    const productWithoutThumbnail = await Product.findOne({
      where: { thumbnail: null },
      include: [{ model: ProductImage, as: "images" }],
    });

    if (productWithoutThumbnail) {
      console.log("Product without thumbnail:", {
        id: productWithoutThumbnail.id,
        name: productWithoutThumbnail.name,
        thumbnail: productWithoutThumbnail.thumbnail,
        thumbnailUrl: productWithoutThumbnail.thumbnailUrl,
        images: productWithoutThumbnail.images.map(img => img.image_url),
      });
    } else {
      console.log("No product found without thumbnail");
    }

    // Test 3: Product without thumbnail and without images
    console.log("\n3. Testing product without thumbnail and without images...");
    const productWithoutImages = await Product.findOne({
      where: { thumbnail: null },
      include: [
        {
          model: ProductImage,
          as: "images",
          where: { id: null }, // This will return products with no images
          required: false,
        },
      ],
    });

    if (productWithoutImages && productWithoutImages.images.length === 0) {
      console.log("Product without images:", {
        id: productWithoutImages.id,
        name: productWithoutImages.name,
        thumbnail: productWithoutImages.thumbnail,
        thumbnailUrl: productWithoutImages.thumbnailUrl,
        images: productWithoutImages.images,
      });
    } else {
      console.log("No product found without images");
    }

    console.log("\n=== Test Complete ===");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Close the database connection
    await sequelize.close();
  }
}

testThumbnailGetter();