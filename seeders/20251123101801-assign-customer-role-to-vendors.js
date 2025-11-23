'use strict';

const { User, Role, UserRole } = require('../models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Idempotent seeder to assign 'customer' role to all users who have 'vendor' role.
     * 
     * This ensures vendors automatically inherit customer permissions (cart, wishlist, orders, etc.)
     * without duplicating role assignments.
     * 
     * Steps:
     * 1. Find customer role
     * 2. Find all users with vendor role
     * 3. For each vendor user, check if they already have customer role
     * 4. If not, assign customer role
     */

    // Step 1: Get customer role
    const customerRole = await Role.findOne({ 
      where: { name: 'customer' } 
    });

    if (!customerRole) {
      throw new Error("Customer role not found. Please run seeders/20250823010000-seed-default-roles.js first.");
    }

    console.log(`Found customer role: ID ${customerRole.id}`);

    // Step 2: Find users with vendor role (using include for efficiency)
    const vendorUsers = await User.findAll({
      include: [{
        model: Role,
        as: 'roles',
        where: { name: 'vendor' },
        required: true,
        through: { attributes: [] }
      }]
    });

    console.log(`Found ${vendorUsers.length} users with vendor role`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Step 3 & 4: Assign customer role idempotently
    for (const user of vendorUsers) {
      // Check if user already has customer role
      const existingUserRole = await UserRole.findOne({
        where: {
          user_id: user.id,
          role_id: customerRole.id
        }
      });

      if (!existingUserRole) {
        // Assign customer role
        await user.addRole(customerRole);
        updatedCount++;
        console.log(`Assigned customer role to vendor user ID: ${user.id}`);
      } else {
        skippedCount++;
      }
    }

    console.log(`Seeder completed: Updated ${updatedCount} users, skipped ${skippedCount} (already had customer role)`);
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Revert: Remove 'customer' role from users who have 'vendor' role.
     * Only removes the association, does not delete roles or users.
     */

    const customerRole = await Role.findOne({ 
      where: { name: 'customer' } 
    });

    if (!customerRole) {
      console.log('Customer role not found, nothing to revert');
      return;
    }

    // Find vendor users with customer role
    const vendorUsersWithCustomer = await User.findAll({
      include: [{
        model: Role,
        as: 'roles',
        where: { name: 'vendor' },
        required: true,
        through: { attributes: [] }
      }, {
        model: Role,
        as: 'roles',
        where: { name: 'customer' },
        required: true,
        through: { attributes: [] }
      }]
    });

    let removedCount = 0;
    for (const user of vendorUsersWithCustomer) {
      await user.removeRole(customerRole);
      removedCount++;
      console.log(`Removed customer role from vendor user ID: ${user.id}`);
    }

    console.log(`Rollback completed: Removed customer role from ${removedCount} vendor users`);
  }
};