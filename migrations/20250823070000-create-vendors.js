"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("vendors", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
        comment: "ID of the user who created the vendor",
      },
      store_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
        comment: "ID of the store associated with the vendor",
      },
      join_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Reason for joining the platform",
      },
      total_sales: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
        comment: "Total sales made by the vendor",
      },
      total_earnings: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
        comment: "Total earnings made by the vendor",
      },
      last_payment_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Date and time of the last payment",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      status: {
        type: Sequelize.ENUM(
          "pending",
          "approved",
          "rejected",
          "registration_complete"
        ),
        allowNull: false,
        defaultValue: "pending",
        comment: "Status of the vendor registration",
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Date and time when the vendor was approved",
      },
      approved_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: "ID of the user who approved the vendor",
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Reason for rejecting the vendor registration",
      },
    });

    await queryInterface.addIndex("vendors", ["approved_by"], {
      name: "vendors_approved_by_foreign_idx",
    });

    await queryInterface.addConstraint("vendors", {
      type: "foreign key",
      fields: ["user_id"],
      name: "vendors_ibfk_1",
      references: {
        table: "users",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("vendors", {
      type: "foreign key",
      fields: ["store_id"],
      name: "vendors_ibfk_2",
      references: {
        table: "stores",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("vendors", {
      type: "foreign key",
      fields: ["approved_by"],
      name: "vendors_approved_by_foreign_idx",
      references: {
        table: "users",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("vendors");
  },
};
