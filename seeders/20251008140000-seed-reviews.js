'use strict';
const { faker } = require('@faker-js/faker/locale/en_US');

// Configure faker
const {
  number: { int: randomNumber },
  lorem: { sentences },
  date: { between },
  helpers: { weightedArrayElement }
} = faker;

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Fetch delivered order items with order details
      console.log('Fetching delivered order items...');

      const deliveredOrderItems = await queryInterface.sequelize.query(
        `SELECT oi.product_id, o.user_id, o.order_date
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.order_status = 'delivered'`,
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      if (deliveredOrderItems.length === 0) {
        throw new Error('No delivered orders found. Please seed orders first.');
      }

      console.log(`Found ${deliveredOrderItems.length} delivered order items`);

      // Limit to 1000 reviews if more available
      const reviewData = deliveredOrderItems.slice(0, 1000);

      console.log(`Creating ${reviewData.length} reviews`);

      // Balanced rating distribution: 20% each for 1-5 stars
      const ratingWeights = [
        { weight: 0.10, value: 1.0 },
        { weight: 0.20, value: 2.0 },
        { weight: 0.30, value: 3.0 },
        { weight: 0.30, value: 4.0 },
        { weight: 0.10, value: 5.0 }
      ];

      const batchSize = 200;
      let totalReviews = 0;

      for (let batchStart = 0; batchStart < reviewData.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, reviewData.length);
        const batch = reviewData.slice(batchStart, batchEnd);

        console.log(`Processing batch: reviews ${batchStart + 1} to ${batchEnd}`);

        const reviewsToInsert = batch.map(item => {
          const rating = weightedArrayElement(ratingWeights).value;
          const hasComment = Math.random() < 0.7;
          const comment = hasComment ? sentences(2) : null;

          // Review created 1-30 days after order date
          const reviewDate = between({
            from: item.order_date,
            to: new Date(Math.min(new Date(item.order_date).getTime() + 30 * 24 * 60 * 60 * 1000, Date.now()))
          });

          return {
            product_id: item.product_id,
            user_id: item.user_id,
            rating,
            comment,
            created_at: reviewDate,
            updated_at: reviewDate
          };
        });

        await queryInterface.bulkInsert('reviews', reviewsToInsert, { transaction });
        totalReviews += reviewsToInsert.length;
      }

      await transaction.commit();
      console.log(`Successfully seeded ${totalReviews} reviews`);

    } catch (error) {
      await transaction.rollback();
      console.error('Error seeding reviews:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.bulkDelete('reviews', null, { transaction });
      await transaction.commit();
      console.log('Cleaned up all seeded reviews');

    } catch (error) {
      await transaction.rollback();
      console.error('Error cleaning up reviews:', error);
      throw error;
    }
  }
};