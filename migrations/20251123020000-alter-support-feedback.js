'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Rename message to description
    await queryInterface.renameColumn('support_feedback', 'message', 'description');

    // Add new fields
    await queryInterface.addColumn('support_feedback', 'subject', {
      type: Sequelize.STRING(150),
      allowNull: false,
      defaultValue: ''
    });

    await queryInterface.addColumn('support_feedback', 'order_number', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: ''
    });

    await queryInterface.addColumn('support_feedback', 'issue_type', {
      type: Sequelize.ENUM(
        'Order Not Delivered',
        'Wrong Item Received',
        'Payment Issue',
        'Return/Refund Request',
        'Account Issue',
        'Technical Issue',
        'Other'
      ),
      allowNull: false,
      defaultValue: 'Other'
    });

    await queryInterface.addColumn('support_feedback', 'preferred_support_method', {
      type: Sequelize.ENUM('Email', 'Phone', 'Chat'),
      allowNull: false,
      defaultValue: 'Email'
    });

    await queryInterface.addColumn('support_feedback', 'contact_email', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('support_feedback', 'contact_phone', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('support_feedback', 'attachments', {
      type: Sequelize.JSON,
      allowNull: true
    });

    await queryInterface.addColumn('support_feedback', 'reference_number', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: ''
    });

    // Update status enum
    await queryInterface.changeColumn('support_feedback', 'status', {
      type: Sequelize.ENUM('open', 'in_progress', 'resolved', 'closed'),
      allowNull: false,
      defaultValue: 'open'
    });

    // Add indexes
    await queryInterface.addIndex('support_feedback', ['reference_number'], {
      name: 'support_feedback_reference_number_unique',
      unique: true
    });

    await queryInterface.addIndex('support_feedback', ['order_number']);
    await queryInterface.addIndex('support_feedback', ['status']);
    await queryInterface.addIndex('support_feedback', ['issue_type']);
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse operations in reverse order
    await queryInterface.dropTable('support_feedback'); // Simple rollback by dropping if needed, or reverse each
    // For production, implement proper reverse
  }
};