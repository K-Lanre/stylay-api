"use strict";
const { faker } = require("@faker-js/faker/locale/en_NG"); // Nigerian locale
const { sequelize } = require("../models");

// Configure faker to use the new API paths
const {
  person,
  finance,
  helpers,
  number: { int: randomNumber },
  image,
  commerce,
  location,
} = faker;

// Helper function for alphanumeric string
const randomAlphaNumeric = (length) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
};
const bcrypt = require("bcryptjs");
const slugify = require("slugify");
require("dotenv").config();

// Generate random business images (1-3 per store)
const generateBusinessImages = (vendorId, count = 3) => {
  const images = [];
  const numImages = randomNumber({ min: 1, max: count });

  for (let i = 0; i < numImages; i++) {
    const width = randomNumber({ min: 400, max: 800 });
    const height = randomNumber({ min: 300, max: 600 });

    images.push(image.urlPicsumPhotos({ width, height }));
  }

  return images;
};

// Generate Nigerian business names
const generateBusinessName = () => {
  const prefixes = [
    "Elite",
    "Royal",
    "Prime",
    "Global",
    "City",
    "Metro",
    "Capital",
    "Heritage",
    "Prestige",
    "Grand",
  ];
  const businessTypes = [
    "Fashion",
    "Electronics",
    "Supermarket",
    "Boutique",
    "Plaza",
    "Mall",
    "Emporium",
    "Trading",
    "Ventures",
    "Enterprises",
  ];
  const suffixes = [
    "NG",
    "Ltd",
    "Limited",
    "Stores",
    "& Sons",
    "& Co",
    "Group",
  ];

  const prefix = helpers.arrayElement(prefixes);
  const businessType = helpers.arrayElement(businessTypes);
  const suffix = helpers.arrayElement(suffixes);

  return `${prefix} ${businessType} ${suffix}`;
};

// Generate random social media handles
const generateSocialMedia = () => ({
  instagram_handle: `vendor_${randomAlphaNumeric(8)}`,
  facebook_handle: `vendor_${randomAlphaNumeric(8)}`,
  twitter_handle: `vendor_${randomAlphaNumeric(8)}`,
});

// Generate Nigerian phone number in +234[70|80|81|90|91]XXXXXXX format
const generateNigerianPhoneNumber = () => {
  // Generate a random number with valid Nigerian prefix and 8 more digits
  return `+234${faker.helpers.arrayElement([
    "70",
    "80",
    "81",
    "90",
    "91",
  ])}${faker.string.numeric(8)}`;
};

// Generate Nigerian bank details
const generateBankDetails = () => {
  const banks = [
    "Access Bank",
    "First Bank",
    "Guaranty Trust Bank",
    "Zenith Bank",
    "United Bank for Africa",
    "Fidelity Bank",
    "Stanbic IBTC",
    "Union Bank",
    "First City Monument Bank",
    "Ecobank",
    "Wema Bank",
    "Polaris Bank",
  ];

  return {
    bank_name: helpers.arrayElement(banks),
    bank_account_name: person.fullName(),
    bank_account_number: finance.accountNumber(10),
  };
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get vendor role ID
    const [role] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'vendor'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!role) {
      throw new Error(
        "Vendor role not found. Please run the roles seeder first."
      );
    }

    // Get the admin user ID
    const [adminUsers] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = 'admin@stylay.com'"
    );

    if (!adminUsers || adminUsers.length === 0) {
      throw new Error(
        'Admin user with email "admin@stylay.com" not found. Please ensure the admin user seeder (20250824020000-seed-admin-user.js) has been run successfully.'
      );
    }
    const adminId = adminUsers[0].id;

    // Get the next available IDs
    const [maxUserResult] = await queryInterface.sequelize.query(
      "SELECT COALESCE(MAX(id), 0) + 1 as maxId FROM users",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [maxVendorResult] = await queryInterface.sequelize.query(
      "SELECT COALESCE(MAX(id), 0) + 1 as maxId FROM vendors",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [maxStoreResult] = await queryInterface.sequelize.query(
      "SELECT COALESCE(MAX(id), 0) + 1 as maxId FROM stores",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const maxUserId = maxUserResult ? maxUserResult.maxId : 1;
    const maxVendorId = maxVendorResult ? maxVendorResult.maxId : 1;
    const maxStoreId = maxStoreResult ? maxStoreResult.maxId : 1;

    const vendors = [];
    const users = [];
    const stores = [];
    const userRoles = [];
    const now = new Date();
    const usedCacNumbers = new Set();

    // Function to generate a unique CAC number
    const generateUniqueCacNumber = () => {
      let attempts = 0;
      const maxAttempts = 100; // Prevent infinite loops

      while (attempts < maxAttempts) {
        const cacNumber = `RC${randomNumber({ min: 10000000, max: 99999999 })}`;
        if (!usedCacNumbers.has(cacNumber)) {
          usedCacNumbers.add(cacNumber);
          return cacNumber;
        }
        attempts++;
      }

      // If we couldn't find a unique number after max attempts, throw an error
      throw new Error(
        "Could not generate a unique CAC number after maximum attempts"
      );
    };

    // Start IDs from the next available
    let userId = maxUserId || 1;
    let vendorId = maxVendorId || 1;
    let storeId = maxStoreId || 1;

    // Generate 10 vendors
    for (let i = 0; i < 10; i++) {
      const firstName = person.firstName();
      const lastName = person.lastName();
      // Ensure unique email for each vendor
      const email = `vendor${i + 1}@stylay.com`; // Using stylay.com domain for test accounts
      // Use a stronger password and ensure it meets validation requirements
      const password = await bcrypt.hash("Vendor@123", 10);
      // Generate a unique business name
      const businessName = `Vendor ${i + 1} ${generateBusinessName()}`;
      const socialMedia = generateSocialMedia();
      const bankDetails = generateBankDetails();
      const businessImages = generateBusinessImages(i + 1); // Use index + 1 as ID

      // Generate user with next available ID
      const currentUserId = userId++;
      users.push({
        id: currentUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: generateNigerianPhoneNumber(),
        password,
        email_verified_at: now,
        is_active: true,
        created_at: now,
        updated_at: now,
      });

      // Generate store with next available ID
      const currentStoreId = storeId++;
      // Generate slug without special characters
      const slug = (
        slugify(businessName, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g,
        }) +
        "-" +
        randomAlphaNumeric(6)
      ).toLowerCase();

      stores.push({
        id: currentStoreId,
        business_name: businessName,
        slug: slug,
        cac_number: generateUniqueCacNumber(),
        instagram_handle: socialMedia.instagram_handle,
        facebook_handle: socialMedia.facebook_handle,
        twitter_handle: socialMedia.twitter_handle,
        business_images: JSON.stringify(businessImages),
        logo: image.avatar(), // Using avatar as logo
        description: `Premium ${businessName} - ${commerce.productDescription()}. Located in ${location.city()}, Nigeria.`,
        bank_account_name: bankDetails.bank_account_name,
        bank_account_number: bankDetails.bank_account_number,
        bank_name: bankDetails.bank_name,
        is_verified: true,
        status: 1, // Active
        created_at: now,
        updated_at: now,
      });

      // Generate vendor with next available ID
      const currentVendorId = vendorId++;
      vendors.push({
        id: currentVendorId,
        user_id: currentUserId,
        store_id: currentStoreId,
        join_reason: faker.helpers.arrayElement([
          "Expand customer reach",
          "Increase sales volume",
          "Access new markets",
          "Benefit from platform marketing",
          "Streamline online operations",
          "Leverage existing customer base",
          "Reduce operational costs",
          "Gain brand visibility",
          "Easy setup and management",
          "Competitive commission rates",
        ]),
        total_sales: 0,
        total_earnings: 0,
        status: "approved",
        approved_at: now,
        approved_by: adminId,
        created_at: now,
        updated_at: now,
      });

      // Assign vendor role
      userRoles.push({
        user_id: currentUserId,
        role_id: role.id,
        created_at: now,
      });
    }

    // Insert data in the correct order to respect foreign key constraints
    await queryInterface.bulkInsert("users", users, {});
    await queryInterface.bulkInsert("stores", stores, {});
    await queryInterface.bulkInsert("vendors", vendors, {});
    await queryInterface.bulkInsert("user_roles", userRoles, {});
  },

  down: async (queryInterface, Sequelize) => {
    // Clean up in reverse order to respect foreign key constraints
    await queryInterface.bulkDelete("user_roles", null, {});
    await queryInterface.bulkDelete("vendors", null, {});
    await queryInterface.bulkDelete("stores", null, {});
    await queryInterface.bulkDelete(
      "users",
      { email: { [Sequelize.Op.like]: "vendor%@stylay.com" } },
      {}
    );
  },
};
