'use strict';
const slugify = require('slugify');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Main fashion categories
    const mainCategories = [
      { 
        name: "Men's Fashion", 
        description: "Trendy and stylish clothing for men" 
      },
      { 
        name: "Women's Fashion", 
        description: "Elegant and fashionable clothing for women" 
      },
      { 
        name: "Kids & Babies", 
        description: "Cute and comfortable clothing for children and babies" 
      },
      { 
        name: "Shoes & Bags", 
        description: "Footwear and bags for all occasions" 
      },
      { 
        name: "Jewelry & Watches", 
        description: "Elegant jewelry and timepieces" 
      },
      { 
        name: "Beauty & Personal Care", 
        description: "Products for personal grooming and beauty" 
      }
    ];

    // Subcategories for Men's Fashion
    const mensSubcategories = [
      { name: "T-Shirts & Polos" },
      { name: "Shirts" },
      { name: "Jeans" },
      { name: "Suits & Blazers" },
      { name: "Activewear" },
      { name: "Underwear & Socks" }
    ];

    // Subcategories for Women's Fashion
    const womensSubcategories = [
      { name: "Dresses & Jumpsuits" },
      { name: "Tops & Blouses" },
      { name: "Jeans & Pants" },
      { name: "Skirts & Shorts" },
      { name: "Activewear" },
      { name: "Lingerie & Sleepwear" }
    ];

    // Subcategories for Kids & Babies
    const kidsSubcategories = [
      { name: "Baby Boys (0-24M)" },
      { name: "Baby Girls (0-24M)" },
      { name: "Boys (2-8Y)" },
      { name: "Girls (2-8Y)" },
      { name: "Boys (9-16Y)" },
      { name: "Girls (9-16Y)" }
    ];

    // Subcategories for Shoes & Bags
    const shoesBagsSubcategories = [
      { name: "Men's Shoes" },
      { name: "Women's Shoes" },
      { name: "Kids' Shoes" },
      { name: "Handbags" },
      { name: "Backpacks" },
      { name: "Wallets & Cardholders" }
    ];

    // Process categories with timestamps
    const now = new Date();
    const categories = [];
    const subcategories = [];
    
    // Add main categories
    for (const [index, category] of mainCategories.entries()) {
      const slug = slugify(category.name, { lower: true, strict: true });
      categories.push({
        id: index + 1,
        name: category.name,
        slug: slug,
        description: category.description,
        parent_id: null,
        created_at: now,
        updated_at: now
      });
    }

    // Add subcategories
    let subcategoryId = categories.length + 1;
    
    // Men's subcategories (parent_id: 1)
    mensSubcategories.forEach((sub, idx) => {
      const slug = slugify(`men-${sub.name}`, { lower: true, strict: true });
      subcategories.push({
        id: subcategoryId + idx,
        name: sub.name,
        slug: slug,
        parent_id: 1, // Men's Fashion
        created_at: now,
        updated_at: now
      });
    });
    subcategoryId += mensSubcategories.length;

    // Women's subcategories (parent_id: 2)
    womensSubcategories.forEach((sub, idx) => {
      const slug = slugify(`women-${sub.name}`, { lower: true, strict: true });
      subcategories.push({
        id: subcategoryId + idx,
        name: sub.name,
        slug: slug,
        parent_id: 2, // Women's Fashion
        created_at: now,
        updated_at: now
      });
    });
    subcategoryId += womensSubcategories.length;

    // Kids subcategories (parent_id: 3)
    kidsSubcategories.forEach((sub, idx) => {
      const slug = slugify(`kids-${sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { lower: true, strict: true });
      subcategories.push({
        id: subcategoryId + idx,
        name: sub.name,
        slug: slug,
        parent_id: 3, // Kids & Babies
        created_at: now,
        updated_at: now
      });
    });
    subcategoryId += kidsSubcategories.length;

    // Shoes & Bags subcategories (parent_id: 4)
    shoesBagsSubcategories.forEach((sub, idx) => {
      const slug = slugify(`shoes-bags-${sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { lower: true, strict: true });
      subcategories.push({
        id: subcategoryId + idx,
        name: sub.name,
        slug: slug,
        parent_id: 4, // Shoes & Bags
        created_at: now,
        updated_at: now
      });
    });

    // Combine all categories and subcategories
    const allCategories = [...categories, ...subcategories];

    // Insert categories into the database
    await queryInterface.bulkInsert('categories', allCategories, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('categories', null, {});
  }
};
