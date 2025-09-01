const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const AppError = require('./appError');

/**
 * Get file extension from mimetype
 * @param {string} mimetype - The mimetype of the file
 * @returns {string} File extension with dot (e.g., '.jpg')
 */
const getFileExtension = (mimetype) => {
  const mimeTypes = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };

  return mimeTypes[mimetype] || '';
};

/**
 * Generate a unique filename
 * @param {string} originalname - Original filename
 * @param {string} mimetype - File mimetype
 * @returns {string} Generated filename with extension
 */
const generateFilename = (originalname, mimetype) => {
  const ext = path.extname(originalname) || getFileExtension(mimetype);
  const uniqueSuffix = `${Date.now()}-${uuidv4().substring(0, 8)}`;
  return `${uniqueSuffix}${ext}`;
};

/**
 * Validate file size
 * @param {Object} file - File object from multer
 * @param {number} maxSizeInMB - Maximum file size in MB
 * @returns {boolean} True if file size is valid
 */
const validateFileSize = (file, maxSizeInMB = 5) => {
  const maxSize = maxSizeInMB * 1024 * 1024; // Convert MB to bytes
  return file.size <= maxSize;
};

/**
 * Validate file type
 * @param {Object} file - File object from multer
 * @param {Array<string>} allowedTypes - Array of allowed mime types
 * @returns {boolean} True if file type is allowed
 */
const validateFileType = (file, allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']) => {
  return allowedTypes.includes(file.mimetype);
};

/**
 * Ensure a directory exists
 * @param {string} dirPath - Path to the directory
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Delete a file if it exists
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if file was deleted, false otherwise
 */
const deleteFileIfExists = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Get file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., '2.5 MB')
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

module.exports = {
  getFileExtension,
  generateFilename,
  validateFileSize,
  validateFileType,
  ensureDirectoryExists,
  deleteFileIfExists,
  formatFileSize,
};
