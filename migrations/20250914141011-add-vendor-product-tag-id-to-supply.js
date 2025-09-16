'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add the vendor_product_tag_id column
    await queryInterface.addColumn('supply', 'vendor_product_tag_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'vendor_product_tags',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    // Add index for better query performance
    await queryInterface.addIndex('supply', ['vendor_product_tag_id'], {
      name: 'supply_vendor_product_tag_id_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove the foreign key constraint first
    await queryInterface.removeConstraint('supply', 'supply_vendor_product_tag_id_foreign');
    
    // Remove the index
    await queryInterface.removeIndex('supply', 'supply_vendor_product_tag_id_idx');
    
    // Remove the column
    await queryInterface.removeColumn('supply', 'vendor_product_tag_id');
  }
};
