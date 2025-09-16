'use strict';
const slugify = require('slugify');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Main gender categories
    const genderCategories = [
      { 
        name: "Men", 
        description: "Trendy and stylish clothing for men",
        slug: "men"
      },
      { 
        name: "Women", 
        description: "Elegant and fashionable clothing for women",
        slug: "women"
      },
      { 
        name: "Kids", 
        description: "Cute and comfortable clothing for children",
        slug: "kids"
      }
    ];

    // Common subcategories for each gender
    const subcategories = [
      { name: "T-shirts", slug: "t-shirts", description: "Comfortable and stylish T-shirts" },
      { name: "Shorts", slug: "shorts", description: "Casual and trendy shorts" },
      { name: "Skirts", slug: "skirts", description: "Fashionable skirts for all occasions" },
      { name: "Hoodies", slug: "hoodies", description: "Warm and cozy hoodies" },
      { name: "Jeans", slug: "jeans", description: "Durable and stylish jeans" }
    ];

    const now = new Date();
    const categoriesToInsert = [];
    
    // Insert main categories first
    const createdCategories = [];
    
    for (const category of genderCategories) {
      let categoryId;

      // Check if category already exists
      const [existingCategory] = await queryInterface.sequelize.query(
        'SELECT id FROM categories WHERE slug = :slug',
        {
          replacements: { slug: category.slug },
          type: queryInterface.sequelize.QueryTypes.SELECT
        }
      );

      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        // Insert main category if it doesn't exist
        await queryInterface.bulkInsert('categories', [{
          name: category.name,
          slug: category.slug,
          description: category.description,
          parent_id: null,
          created_at: now,
          updated_at: now
        }]);

        // Get the newly inserted category ID
        const [newCategory] = await queryInterface.sequelize.query(
          'SELECT id FROM categories WHERE slug = :slug',
          {
            replacements: { slug: category.slug },
            type: queryInterface.sequelize.QueryTypes.SELECT
          }
        );
        categoryId = newCategory.id;
      }
      
      if (categoryId) {
        createdCategories.push({
          id: categoryId,
          name: category.name,
          slug: category.slug
        });
      }
    }
    
    // Insert subcategories for each main category
    for (const mainCategory of createdCategories) {
      for (const subcategory of subcategories) {
        await queryInterface.bulkInsert('categories', [{
          name: `${mainCategory.name} ${subcategory.name}`,
          slug: `${mainCategory.slug}-${subcategory.slug}`,
          description: subcategory.description,
          parent_id: mainCategory.id,
          created_at: now,
          updated_at: now
        }]);
      }
    }
    
    return createdCategories;
  },

  async down(queryInterface, Sequelize) {
    // First delete subcategories
    await queryInterface.bulkDelete('categories', {
      parent_id: {
        [Sequelize.Op.ne]: null
      }
    });
    
    // Then delete main categories
    await queryInterface.bulkDelete('categories', {
      parent_id: null
    });
  }
};
