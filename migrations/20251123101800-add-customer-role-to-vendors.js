'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * No schema changes needed. The user_roles pivot table already exists
     * from migration 20250823060000-create-user-roles.js.
     * 
     * This migration serves as a documentation marker for the process of
     * assigning 'customer' role to all existing 'vendor' users.
     * 
     * Roles and permissions are handled in seeders:
     * - seeders/20250823010000-seed-default-roles.js (includes customer role)
     * - seeders/20250823020000-seed-permissions.js (assigns permissions to roles)
     * - seeders/20251123101801-assign-customer-role-to-vendors.js (assigns role to users)
     */
    console.log('Migration marker: Vendor-Customer role setup ready (no schema changes)');
  },

  async down(queryInterface, Sequelize) {
    /**
     * No schema changes to revert.
     */
    console.log('Rollback marker: No schema changes to revert');
  }
};