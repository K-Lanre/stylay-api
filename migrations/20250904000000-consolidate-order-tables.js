'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. Add new columns to orders table
      await queryInterface.addColumn('orders', 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
        after: 'total_amount'
      }, { transaction });
      
      await queryInterface.addColumn('orders', 'shipping_details', {
        type: Sequelize.TEXT,
        allowNull: true,
        after: 'notes'
      }, { transaction });
      
      // 2. Migrate data from order_info to orders.notes
      const [orderInfos] = await queryInterface.sequelize.query(
        'SELECT order_id, info FROM order_info',
        { transaction }
      );
      
      for (const info of orderInfos) {
        await queryInterface.sequelize.query(
          'UPDATE orders SET notes = ? WHERE id = ?',
          {
            replacements: [info.info, info.order_id],
            transaction
          }
        );
      }
      
      // 3. Migrate data from order_details to orders.shipping_details
      const [orderDetails] = await queryInterface.sequelize.query(
        'SELECT order_id, details FROM order_details',
        { transaction }
      );
      
      for (const detail of orderDetails) {
        await queryInterface.sequelize.query(
          'UPDATE orders SET shipping_details = ? WHERE id = ?',
          {
            replacements: [detail.details, detail.order_id],
            transaction
          }
        );
      }
      
      // 4. Drop the redundant tables
      await queryInterface.dropTable('order_info', { transaction });
      await queryInterface.dropTable('order_details', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Recreate dropped tables
      await queryInterface.createTable('order_info', {
        id: {
          type: Sequelize.BIGINT({ unsigned: true }),
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        order_id: {
          type: Sequelize.BIGINT({ unsigned: true }),
          allowNull: false,
          unique: true
        },
        info: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });
      
      await queryInterface.createTable('order_details', {
        id: {
          type: Sequelize.BIGINT({ unsigned: true }),
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        order_id: {
          type: Sequelize.BIGINT({ unsigned: true }),
          allowNull: false
        },
        details: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });
      
      // Migrate data back
      const orders = await queryInterface.sequelize.query(
        'SELECT id, notes, shipping_details FROM orders',
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );
      
      for (const order of orders) {
        if (order.notes) {
          await queryInterface.bulkInsert('order_info', [{
            order_id: order.id,
            info: order.notes,
            created_at: new Date()
          }], { transaction });
        }
        
        if (order.shipping_details) {
          await queryInterface.bulkInsert('order_details', [{
            order_id: order.id,
            details: order.shipping_details,
            created_at: new Date()
          }], { transaction });
        }
      }
      
      // Remove added columns
      await queryInterface.removeColumn('orders', 'notes', { transaction });
      await queryInterface.removeColumn('orders', 'shipping_details', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
