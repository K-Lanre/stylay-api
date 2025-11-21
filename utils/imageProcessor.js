const fs = require('fs');
const path = require('path');
const AppError = require('./appError');
const storage = require('../config/storage');

/**
 * Enhanced image processor that supports multiple input formats:
 * - Multipart/form-data files (existing)
 * - Base64 encoded images
 * - Raw binary data
 * - URL references
 */
class ImageProcessor {
  constructor(options = {}) {
    this.allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB
    this.uploadPath = options.uploadPath || 'product-images';
  }

  /**
   * Process images from various sources and return unified format
   * @param {Object} req - Express request object
   * @param {Object} options - Processing options
   * @returns {Array} Array of processed image objects
   */
  async processImages(req, options = {}) {
    const { fieldName = 'images', maxCount = 10 } = options;
    const processedImages = [];

    console.log('=== IMAGE PROCESSOR DIAGNOSTIC ===');
    console.log('Processing images for field:', fieldName);
    console.log('Max count:', maxCount);

    // 1. Process multipart/form-data files (existing functionality)
    if (req.uploadedFiles && req.uploadedFiles.length > 0) {
      console.log('Found uploadedFiles:', req.uploadedFiles.length);
      const multipartImages = req.uploadedFiles.filter(file => file.fieldname === fieldName);
      for (const file of multipartImages) {
        if (processedImages.length >= maxCount) break;
        processedImages.push({
          url: file.url,
          source: 'multipart',
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          fieldname: file.fieldname,
          path: file.path
        });
      }
    }

    // 2. Process images from request body (new functionality)
    if (req.body && req.body[fieldName]) {
      console.log('Found images in request body');
      const bodyImages = Array.isArray(req.body[fieldName]) ? req.body[fieldName] : [req.body[fieldName]];

      for (const imageData of bodyImages) {
        if (processedImages.length >= maxCount) break;

        if (typeof imageData === 'string') {
          // Handle base64 encoded images or URLs
          if (this.isBase64Image(imageData)) {
            const processedImage = await this.processBase64Image(imageData, fieldName);
            if (processedImage) {
              processedImages.push({ ...processedImage, source: 'base64' });
            }
          } else if (this.isValidUrl(imageData)) {
            // Handle URL references
            processedImages.push({
              url: imageData,
              source: 'url',
              filename: null,
              originalname: null,
              mimetype: null,
              size: null
            });
          }
        } else if (imageData && typeof imageData === 'object') {
          // Handle object format (e.g., { data: base64, filename: '...' })
          if (imageData.data && this.isBase64Image(imageData.data)) {
            const processedImage = await this.processBase64Image(imageData.data, fieldName, imageData.filename);
            if (processedImage) {
              processedImages.push({ ...processedImage, source: 'base64_object' });
            }
          } else if (imageData.url && this.isValidUrl(imageData.url)) {
            processedImages.push({
              url: imageData.url,
              source: 'url_object',
              filename: imageData.filename || null,
              originalname: imageData.originalname || null,
              mimetype: imageData.mimetype || null,
              size: imageData.size || null
            });
          }
        }
      }
    }

    console.log('Total processed images:', processedImages.length);
    console.log('=====================================');

    return processedImages;
  }

  /**
   * Check if string is a base64 encoded image
   * @param {string} str - String to check
   * @returns {boolean}
   */
  isBase64Image(str) {
    // Check for data URL format: data:image/jpeg;base64,...
    const dataUrlRegex = /^data:image\/(jpeg|png|jpg|webp);base64,/i;
    return dataUrlRegex.test(str);
  }

  /**
   * Check if string is a valid URL
   * @param {string} str - String to check
   * @returns {boolean}
   */
  isValidUrl(str) {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Process base64 encoded image
   * @param {string} base64Data - Base64 encoded image data
   * @param {string} fieldName - Field name for filename generation
   * @param {string} customFilename - Optional custom filename
   * @returns {Object|null} Processed image object or null if failed
   */
  async processBase64Image(base64Data, fieldName, customFilename = null) {
    try {
      // Extract mime type and base64 data
      const matches = base64Data.match(/^data:image\/(jpeg|png|jpg|webp);base64,(.+)$/i);
      if (!matches) {
        throw new Error('Invalid base64 image format');
      }

      const mimeType = `image/${matches[1].toLowerCase()}`;
      const base64Image = matches[2];

      // Validate mime type
      if (!this.allowedTypes.includes(mimeType)) {
        throw new Error(`Invalid image type: ${mimeType}`);
      }

      // Decode base64
      const imageBuffer = Buffer.from(base64Image, 'base64');

      // Check file size
      if (imageBuffer.length > this.maxSize) {
        throw new Error(`Image too large: ${imageBuffer.length} bytes (max: ${this.maxSize})`);
      }

      // Generate filename
      const extension = this.getExtensionFromMimeType(mimeType);
      const filename = customFilename || this.generateUniqueFilename(fieldName, extension);

      // Get storage disk
      const disk = storage.getDisk(this.uploadPath);
      if (!disk) {
        throw new Error(`Invalid storage disk: ${this.uploadPath}`);
      }

      // Create upload directory
      const uploadDir = path.join(process.cwd(), disk.root);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Save file
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, imageBuffer);

      // Generate URL
      const url = `${process.env.APP_URL || 'http://localhost:3000'}/uploads/${this.uploadPath}/${filename}`;

      return {
        url,
        filename,
        originalname: customFilename || `base64-image.${extension}`,
        mimetype: mimeType,
        size: imageBuffer.length,
        path: filepath
      };
    } catch (error) {
      console.error('Error processing base64 image:', error.message);
      return null;
    }
  }

  /**
   * Get file extension from mime type
   * @param {string} mimeType - MIME type
   * @returns {string} File extension
   */
  getExtensionFromMimeType(mimeType) {
    const extensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/jpg': 'jpg',
      'image/webp': 'webp'
    };
    return extensions[mimeType] || 'jpg';
  }

  /**
   * Generate unique filename
   * @param {string} fieldName - Field name
   * @param {string} extension - File extension
   * @returns {string} Unique filename
   */
  generateUniqueFilename(fieldName, extension) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    return `${fieldName}-${uniqueSuffix}.${extension}`;
  }

  /**
   * Validate processed images
   * @param {Array} images - Array of processed images
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateImages(images, options = {}) {
    const { minCount = 0, maxCount = 10 } = options;
    const errors = [];

    if (images.length < minCount) {
      errors.push(`At least ${minCount} images required`);
    }

    if (images.length > maxCount) {
      errors.push(`Maximum ${maxCount} images allowed`);
    }

    // Check for invalid images
    const invalidImages = images.filter(img => !img.url);
    if (invalidImages.length > 0) {
      errors.push(`${invalidImages.length} images failed to process`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = ImageProcessor;