const { Journal, Sequelize } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');

// Helper function to check existing tags
const checkExistingTags = async (tags) => {
  if (typeof tags === 'string') {
    try {
      tags = JSON.parse(tags);
    } catch (error) {
      // If parsing fails, treat it as a single tag
      tags = [tags];
    }
  }

  if (!tags || tags.length === 0) return { existing: [], new: tags };
  
  try {
    // Get all existing tags from journals
    const journals = await Journal.findAll({
      where: {
        tags: {
          [Op.not]: null
        }
      },
      attributes: ['tags']
    });
    
    // Extract all existing tags
    const existingTags = new Set();
    journals.forEach(journal => {
      if (journal.tags && Array.isArray(journal.tags)) {
        journal.tags.forEach(tag => existingTags.add(tag.toLowerCase()));
      }
    });
    
    // Check which tags exist and which are new
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }
    const inputTags = tags.map(tag => tag.toLowerCase());
    const existingTagNames = inputTags.filter(tag => existingTags.has(tag));
    const newTagNames = inputTags.filter(tag => !existingTags.has(tag));
    
    return {
      existing: existingTagNames,
      new: newTagNames
    };
  } catch (error) {
    console.error('Error checking existing tags:', error);
    return { existing: [], new: Array.isArray(tags) ? tags : [] };
  }
};

// Get all journals with optional filtering
const getAllJournals = async (req, res) => {
  try {
    const { category, tags, sort_by = 'created_at', order = 'DESC', page = 1, limit = 10 } = req.query;
    
    const whereClause = {};
    
    // Filter by category
    if (category) {
      whereClause.category = category;
    }
    
    // Filter by tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      whereClause[Op.and] = tagArray.map(tag =>
        Sequelize.where(
          Sequelize.fn('JSON_SEARCH', Sequelize.col('tags'), 'one', tag),
          'IS NOT',
          null
        )
      );
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const journals = await Journal.findAndCountAll({
      where: whereClause,
      order: [[sort_by, order.toUpperCase()]],
      limit: parseInt(limit),
      offset,
      attributes: {
        exclude: ['updated_at']
      }
    });
    
    res.json({
      success: true,
      data: journals.rows,
      pagination: {
        total: journals.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(journals.count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch journals',
      error: error.message
    });
  }
};

// Get a single journal by ID (increments view count)
const getJournalById = async (req, res) => {
  try {
    const journal = await Journal.findByPk(req.params.id);
    
    if (!journal) {
      return res.status(404).json({
        success: false,
        message: 'Journal not found'
      });
    }
    
    // Increment view count
    await journal.incrementViewCount();
    
    res.json({
      success: true,
      data: journal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch journal',
      error: error.message
    });
  }
};

// Create a new journal
const createJournal = async (req, res) => {
  try {
    const { title, content, excerpt, tags, category, featured_images } = req.body;
    
    // Check existing tags
    const tagCheck = await checkExistingTags(tags);
    
    // Handle uploaded files from middleware
    const uploadedImages = req.uploadedFiles || [];
    
    // Convert uploaded files to the expected format
    const uploadedImageObjects = uploadedImages.map(file => ({
      url: file.url,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    }));
    
    // Merge uploaded images with any featured_images from request body
    const allFeaturedImages = [];
    if (featured_images && Array.isArray(featured_images)) {
      allFeaturedImages.push(...featured_images);
    }
    allFeaturedImages.push(...uploadedImageObjects);
    
    const journal = await Journal.create({
      title,
      content,
      excerpt,
      tags: tags || null,
      category: category || null,
      featured_images: allFeaturedImages.length > 0 ? allFeaturedImages : null
    });
    
    // Prepare response message with tag information
    let message = 'Journal created successfully';
    const tagInfo = [];

    if (tagCheck.existing.length > 0) {
      tagInfo.push(`Used existing tags: ${tagCheck.existing.join(', ')}`);
    }
    if (tagCheck.new.length > 0) {
      tagInfo.push(`Added new tags: ${tagCheck.new.join(', ')}`);
    }

    if (tagInfo.length > 0) {
      message += ' ' + tagInfo.join(', ');
    }
    
    res.status(201).json({
      success: true,
      message,
      data: journal,
      tagInfo: {
        existing: tagCheck.existing,
        new: tagCheck.new
      }
    });
  } catch (error) {
    // Clean up uploaded images if creation failed
    if (req.uploadedFiles && req.uploadedFiles.length > 0) {
      req.uploadedFiles.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log(`Cleaned up file: ${file.path}`);
          } catch (cleanupError) {
            console.warn(`Failed to clean up file ${file.path}:`, cleanupError.message);
          }
        }
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create journal',
      error: error.message
    });
  }
};

// Update a journal
const updateJournal = async (req, res) => {
  try {
    const journal = await Journal.findByPk(req.params.id);
    
    if (!journal) {
      return res.status(404).json({
        success: false,
        message: 'Journal not found'
      });
    }
    
    const { title, content, excerpt, tags, category, featured_images } = req.body;
    
    // Check existing tags if tags are being updated
    let tagCheck = null;
    if (tags !== undefined) {
      tagCheck = await checkExistingTags(tags);
    }
    
    // Handle uploaded files from middleware
    const uploadedImages = req.uploadedFiles || [];
    
    // Convert uploaded files to the expected format
    const uploadedImageObjects = uploadedImages.map(file => ({
      url: file.url,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    }));
    
    // Merge uploaded images with any featured_images from request body
    let allFeaturedImages = [];
    if (featured_images && Array.isArray(featured_images)) {
      allFeaturedImages.push(...featured_images);
    }
    allFeaturedImages.push(...uploadedImageObjects);
    
    // Update journal
    await journal.update({
      title: title || journal.title,
      content: content || journal.content,
      excerpt: excerpt !== undefined ? excerpt : journal.excerpt,
      tags: tags !== undefined ? tags : journal.tags,
      category: category !== undefined ? category : journal.category,
      featured_images: allFeaturedImages.length > 0 ? allFeaturedImages : (featured_images === null ? null : journal.featured_images)
    });
    
    // Prepare response message with tag information if tags were updated
    let message = 'Journal updated successfully';
    let responseTagInfo = null;

    if (tagCheck) {
      responseTagInfo = {
        existing: tagCheck.existing,
        new: tagCheck.new
      };

      const tagInfo = [];
      if (tagCheck.existing.length > 0) {
        tagInfo.push(`Used existing tags: ${tagCheck.existing.join(', ')}`);
      }
      if (tagCheck.new.length > 0) {
        tagInfo.push(`Added new tags: ${tagCheck.new.join(', ')}`);
      }

      if (tagInfo.length > 0) {
        message += ' ' + tagInfo.join(', ');
      }
    }
    
    res.json({
      success: true,
      message,
      data: journal,
      tagInfo: responseTagInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update journal',
      error: error.message
    });
  }
};

// Delete a journal
const deleteJournal = async (req, res) => {
  try {
    const journal = await Journal.findByPk(req.params.id);
    
    if (!journal) {
      return res.status(404).json({
        success: false,
        message: 'Journal not found'
      });
    }
    
    await journal.destroy();
    
    res.json({
      success: true,
      message: 'Journal deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete journal',
      error: error.message
    });
  }
};

// Get all unique tags
const getAllTags = async (req, res) => {
  try {
    const journals = await Journal.findAll({
      where: {
        tags: {
          [Op.not]: null
        }
      },
      attributes: ['tags']
    });
    
    // Extract and flatten all tags
    const allTags = journals.reduce((tags, journal) => {
      if (journal.tags && Array.isArray(journal.tags)) {
        tags.push(...journal.tags);
      }
      return tags;
    }, []);
    
    // Get unique tags and count
    const uniqueTags = [...new Set(allTags)].map(tag => ({
      tag,
      count: allTags.filter(t => t === tag).length
    }));
    
    res.json({
      success: true,
      data: uniqueTags.sort((a, b) => b.count - a.count)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tags',
      error: error.message
    });
  }
};

// Get all unique categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await Journal.findAll({
      where: {
        category: {
          [Op.not]: null
        }
      },
      attributes: ['category']
    });
    
    // Extract all categories
    const allCategories = categories.map(journal => journal.category).filter(Boolean);
    
    // Get unique categories and count
    const uniqueCategories = [...new Set(allCategories)].map(category => ({
      category,
      count: allCategories.filter(c => c === category).length
    }));
    
    res.json({
      success: true,
      data: uniqueCategories.sort((a, b) => b.count - a.count)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

module.exports = {
  getAllJournals,
  getJournalById,
  createJournal,
  updateJournal,
  deleteJournal,
  getAllTags,
  getAllCategories
};

// Check if tags exist
const checkTagsExist = async (req, res) => {
  try {
    const { tags } = req.query;
    
    if (!tags) {
      return res.status(400).json({
        success: false,
        message: 'Tags parameter is required'
      });
    }
    
    // Parse tags from query (can be comma-separated or array)
    const tagArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(t => t);
    
    if (tagArray.length === 0) {
      return res.json({
        success: true,
        data: {
          existing: [],
          new: [],
          message: 'No tags provided'
        }
      });
    }
    
    const tagCheck = await checkExistingTags(tagArray);
    
    res.json({
      success: true,
      data: {
        existing: tagCheck.existing,
        new: tagCheck.new,
        total: tagArray.length,
        existingCount: tagCheck.existing.length,
        newCount: tagCheck.new.length
      },
      message: tagCheck.existing.length > 0
        ? `Found ${tagCheck.existing.length} existing tag${tagCheck.existing.length > 1 ? 's' : ''} and ${tagCheck.new.length} new tag${tagCheck.new.length > 1 ? 's' : ''}`
        : `All ${tagCheck.new.length} tag${tagCheck.new.length > 1 ? 's' : ''} are new`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check tags',
      error: error.message
    });
  }
};

// Add the new endpoint to exports
module.exports = {
  getAllJournals,
  getJournalById,
  createJournal,
  updateJournal,
  deleteJournal,
  getAllTags,
  getAllCategories,
  checkTagsExist
};

// Get tag suggestions for autocomplete
const getTagSuggestions = async (req, res) => {
  try {
    const { q } = req.query; // q = query parameter for partial tag search
    
    if (!q || q.length < 1) {
      return res.json({
        success: true,
        data: [],
        message: 'Query parameter is too short (minimum 1 character)'
      });
    }
    
    // Get all existing tags from journals
    const journals = await Journal.findAll({
      where: {
        tags: {
          [Op.not]: null
        }
      },
      attributes: ['tags']
    });
    
    // Extract and flatten all tags
    const allTags = journals.reduce((tags, journal) => {
      if (journal.tags && Array.isArray(journal.tags)) {
        tags.push(...journal.tags);
      }
      return tags;
    }, []);
    
    // Get unique tags with counts
    const uniqueTags = {};
    allTags.forEach(tag => {
      const lowerTag = tag.toLowerCase();
      if (uniqueTags[lowerTag]) {
        uniqueTags[lowerTag].count++;
      } else {
        uniqueTags[lowerTag] = {
          tag: tag,
          count: 1
        };
      }
    });
    
    // Filter tags that match the query (case-insensitive)
    const query = q.toLowerCase();
    const matchedTags = Object.values(uniqueTags)
      .filter(tagObj => tagObj.tag.toLowerCase().includes(query))
      .sort((a, b) => {
        // Sort by: exact match first, then by frequency, then alphabetically
        const aExact = a.tag.toLowerCase() === query ? 0 : 1;
        const bExact = b.tag.toLowerCase() === query ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        if (b.count !== a.count) return b.count - a.count;
        return a.tag.localeCompare(b.tag);
      })
      .slice(0, 10); // Limit to 10 suggestions
    
    res.json({
      success: true,
      data: matchedTags,
      query: q,
      totalFound: matchedTags.length,
      message: matchedTags.length > 0
        ? `Found ${matchedTags.length} tag${matchedTags.length > 1 ? 's' : ''} matching "${q}"`
        : `No tags found matching "${q}"`
 });
 } catch (error) {
 res.status(500).json({
 success: false,
 message: 'Failed to get tag suggestions',
 error: error.message
 });
 }
};

// Get popular tags (for initial display)
const getPopularTags = async (req, res) => {
 try {
 const { limit = 20 } = req.query;
 
 // Get all existing tags from journals
 const journals = await Journal.findAll({
 where: {
 tags: {
 [Op.not]: null
 }
 },
 attributes: ['tags']
 });
 
 // Extract and flatten all tags
 const allTags = journals.reduce((tags, journal) => {
 if (journal.tags && Array.isArray(journal.tags)) {
 tags.push(...journal.tags);
 }
 return tags;
 }, []);
 
 // Get unique tags with counts
 const uniqueTags = [...new Set(allTags)].map(tag => ({
 tag,
 count: allTags.filter(t => t === tag).length
 }));
 
 // Sort by popularity and limit
 const popularTags = uniqueTags
 .sort((a, b) => b.count - a.count)
 .slice(0, parseInt(limit));
 
 res.json({
 success: true,
 data: popularTags,
 total: uniqueTags.length,
 limit: parseInt(limit),
 message: `Showing top ${popularTags.length} popular tag${popularTags.length > 1 ? 's' : ''}`
 });
 } catch (error) {
 res.status(500).json({
 success: false,
 message: 'Failed to get popular tags',
 error: error.message
 });
 }
};

// Update exports
module.exports = {
 getAllJournals,
 getJournalById,
 createJournal,
 updateJournal,
 deleteJournal,
 getAllTags,
 getAllCategories,
 checkTagsExist,
 getTagSuggestions,
 getPopularTags
};
