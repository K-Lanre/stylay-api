'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // First, find all duplicate cac_numbers
      const [results] = await queryInterface.sequelize.query(
        `SELECT cac_number, COUNT(*) as count 
         FROM stores 
         WHERE cac_number IS NOT NULL 
         GROUP BY cac_number 
         HAVING count > 1`,
        { transaction }
      );

      // For each duplicate, keep the first one and nullify the rest
      for (const row of results) {
        await queryInterface.sequelize.query(
          `UPDATE stores 
           SET cac_number = NULL 
           WHERE id NOT IN (
             SELECT id FROM (
               SELECT MIN(id) as id 
               FROM stores 
               WHERE cac_number = :cacNumber
             ) as t
           ) 
           AND cac_number = :cacNumber`,
          {
            replacements: { cacNumber: row.cac_number },
            transaction
          }
        );
      }

      // Add unique constraint to cac_number
      await queryInterface.addConstraint('stores', {
        fields: ['cac_number'],
        type: 'unique',
        name: 'unique_cac_number',
        where: {
          cac_number: {
            [Sequelize.Op.ne]: null
          }
        },
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('stores', 'unique_cac_number');
  }
};
