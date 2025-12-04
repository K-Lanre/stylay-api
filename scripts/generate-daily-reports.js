const { sequelize } = require('../config/database');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');

async function generateDailyReports() {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    console.log('Generating daily reports...');

    // Sales report
    const salesReport = await Order.findAll({
      where: {
        createdAt: {
          [sequelize.Op.gte]: startOfDay,
          [sequelize.Op.lt]: endOfDay
        },
        status: ['completed', 'paid']
      },
      attributes: [
        [sequelize.fn('COUNT', '*'), 'orderCount'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalRevenue'],
        [sequelize.fn('AVG', sequelize.col('total_amount')), 'averageOrderValue']
      ]
    });

    // Product performance
    const productReport = await Product.findAll({
      attributes: [
        'name',
        [sequelize.fn('COUNT', '*'), 'orderCount'],
        [sequelize.fn('SUM', sequelize.col('order_items.quantity')), 'totalSold']
      ],
      include: [{
        model: Order,
        as: 'orders',
        through: { attributes: [] },
        where: {
          createdAt: {
            [sequelize.Op.gte]: startOfDay,
            [sequelize.Op.lt]: endOfDay
          }
        }
      }],
      group: ['Product.id'],
      order: [[sequelize.literal('totalSold'), 'DESC']],
      limit: 10
    });

    // User registration report
    const userReport = await User.count({
      where: {
        createdAt: {
          [sequelize.Op.gte]: startOfDay,
          [sequelize.Op.lt]: endOfDay
        }
      }
    });

    // Log reports
    logger.info('Daily Sales Report:', {
      date: today.toISOString().split('T')[0],
      orders: salesReport[0].dataValues.orderCount,
      revenue: salesReport[0].dataValues.totalRevenue,
      averageOrderValue: salesReport[0].dataValues.averageOrderValue
    });

    logger.info('Top Products:', productReport.map(p => ({
      name: p.name,
      sold: p.dataValues.totalSold
    })));

    logger.info('New Users:', userReport);

    console.log('Daily reports generated successfully');
  } catch (error) {
    console.error('Error generating daily reports:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

generateDailyReports();