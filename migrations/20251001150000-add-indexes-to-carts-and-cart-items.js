'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add index on carts.user_id if not exists (for faster cart lookup by user)
    await queryInterface.addIndex('carts', ['user_id'], {
      name: 'idx_carts_user_id',
      where: { user_id: { [Sequelize.Op.ne]: null } },
      unique: true
    });

    // Add composite index on cart_items for faster lookups by cart_id, product_id (helps with finding existing items)
    await queryInterface.addIndex('cart_items', ['cart_id', 'product_id'], {
      name: 'idx_cart_items_cart_product'
    });

    // Note: selected_variants is JSON; for MySQL 5.7+, we could add a functional index, but keeping simple for now
    // This prevents lock contention by speeding up SELECTs before UPDATEs
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('carts', 'idx_carts_user_id');
    await queryInterface.removeIndex('cart_items', 'idx_cart_items_cart_product');
  }
};