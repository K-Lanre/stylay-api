'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Journal extends Model {
    static associate(models) {
      // Remove product association as it's no longer needed
    }

    // Instance method to increment view count
    async incrementViewCount() {
      this.view_count += 1;
      await this.save();
    }

    // Instance method to get formatted tags
    getFormattedTags() {
      return this.tags || [];
    }

    // Instance method to get featured images URLs
    getFeaturedImageUrls() {
      if (!this.featured_images) return [];
      return this.featured_images.map(img => img.url);
    }

    // Instance method to get primary featured image
    getPrimaryFeaturedImage() {
      if (!this.featured_images || this.featured_images.length === 0) return null;
      return this.featured_images[0].url;
    }
  }

  Journal.init({
    id: {
      type: DataTypes.BIGINT({ unsigned: true }),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Title is required'
        },
        len: {
          args: [5, 255],
          msg: 'Title must be between 5 and 255 characters'
        }
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Content is required'
        },
        min: {
          args: [10],
          msg: 'Content must be at least 10 characters'
        }
      }
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Brief summary or teaser for the journal post'
    },
    view_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of times this journal post has been viewed'
    },
    featured_images: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of featured image objects with URLs and metadata',
      validate: {
        isValidFeaturedImages(value) {
          if (value && !Array.isArray(value)) {
            throw new Error('Featured images must be an array');
          }
          if (value && value.length > 10) {
            throw new Error('Maximum 10 featured images allowed');
          }
        }
      }
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of tag strings for categorization and search',
      validate: {
        isValidTags(value) {
          if (value && !Array.isArray(value)) {
            throw new Error('Tags must be an array');
          }
          if (value && value.length > 20) {
            throw new Error('Maximum 20 tags allowed');
          }
          if (value && value.some(tag => typeof tag !== 'string' || tag.length > 50)) {
            throw new Error('Tags must be strings with maximum 50 characters each');
          }
        }
      },
      get() {
        const rawValue = this.getDataValue('tags');
        if (typeof rawValue === 'string') {
          try {
            return JSON.parse(rawValue);
          } catch (e) {
            return [];
          }
        }
        return rawValue || [];
      },
      set(value) {
        if (Array.isArray(value)) {
          this.setDataValue('tags', value);
        } else if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            this.setDataValue('tags', parsed);
          } catch (e) {
            this.setDataValue('tags', []);
          }
        } else {
          this.setDataValue('tags', []);
        }
      }
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Main category for the journal post',
      validate: {
        len: {
          args: [0, 100],
          msg: 'Category must be maximum 100 characters'
        }
      }
    }
  }, {
    sequelize,
    modelName: 'Journal',
    tableName: 'journals',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['category']
      },
      {
        fields: ['view_count']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Journal;
};
