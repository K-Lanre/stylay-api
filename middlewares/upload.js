const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const AppError = require('../utils/appError');
const { v4: uuidv4 } = require('uuid');

// Default file upload configuration
const defaultFileUploadConfig = {
  useTempFiles: false, // Don't use temp files to avoid cleanup issues
  createParentPath: true,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 11, // Maximum number of files
    headerPairs: 200, // Increase if you have many headers
    parts: 100, // Increase parts limit
    headerSize: 1024 * 1024 // 1MB header size limit
  },
  abortOnLimit: false, // Set to false to handle limit errors manually
  safeFileNames: true,
  preserveExtension: true,
  debug: process.env.NODE_ENV === 'development',
  parseNested: false, // Disable nested form data parsing
  uriDecodeFileNames: true,
  // Handle file uploads in memory with a 10MB limit
  limits: { fileSize: 10 * 1024 * 1024 },
  // Increase the maximum number of fields to parse (default is 1000)
  maxFields: 50,
  // Increase the maximum number of files (default is 10)
  maxFiles: 11,
  // Increase the maximum number of parts (fields + files) (default is 1000)
  maxFieldsSize: 20 * 1024 * 1024, // 20MB
  // Set a higher limit for the number of headers
  maxHeaderPairs: 2000
};

/**
 * Middleware for handling file uploads
 * @param {Object} options - Upload options
 * @returns {Function} Express middleware function
 */
const uploadFiles = (options = {}) => {
  const { 
    fieldName = 'files', 
    maxCount = 5, 
    allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    uploadPath = 'uploads/'
  } = options;

  // Create a new fileUpload instance with the provided options
  const fileUploader = fileUpload({
    ...defaultFileUploadConfig,
    limits: {
      ...defaultFileUploadConfig.limits,
      files: maxCount
    },
    // Explicitly set the file upload handler
    useTempFiles: false, // Don't use temp files to avoid cleanup issues
    createParentPath: true
  });

  // Return the middleware function
  return [
    // First middleware: Handle file upload
    (req, res, next) => {
      // Set timeout to prevent hanging
      req.setTimeout(30000); // 30 seconds timeout
      
      // Handle the file upload
      fileUploader(req, res, (err) => {
        if (err) {
          // Clean up any uploaded files on error
          if (req.files) {
            Object.values(req.files).flat().forEach(file => {
              if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
                fs.unlinkSync(file.tempFilePath);
              }
            });
          }
          return next(new AppError(`File upload error: ${err.message}`, 400));
        }
        
        // If no files were uploaded, continue to next middleware
        if (!req.files || Object.keys(req.files).length === 0) {
          return next();
        }
        
        // Process the files in the next middleware
        next();
      });
    },
    
    // Second middleware: Process uploaded files
    async (req, res, next) => {
      try {
        if (!req.files || Object.keys(req.files).length === 0) {
          return next();
        }

        const files = Array.isArray(req.files[fieldName]) 
          ? req.files[fieldName] 
          : [req.files[fieldName]];

        // Validate file count
        if (files.length > maxCount) {
          return next(new AppError(`Maximum ${maxCount} files are allowed`, 400));
        }

        // Process each file
        const processedFiles = [];
        
        for (const file of files) {
          try {
            // Validate file type
            if (!allowedTypes.includes(file.mimetype)) {
              return next(new AppError(`Invalid file type: ${file.name}. Allowed types: ${allowedTypes.join(', ')}`, 400));
            }

            // Generate unique filename
            const fileExt = path.extname(file.name);
            const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
            const relativePath = path.join(uploadPath, fileName).replace(/\\/g, '/');
            const fullPath = path.join(process.cwd(), 'public', relativePath);

            // Ensure upload directory exists
            await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

            // Move file to uploads directory
            await file.mv(fullPath);

            processedFiles.push({
              fieldname: file.name, // Keep the original fieldname
              name: file.name,
              mimetype: file.mimetype,
              size: file.size,
              path: `/${relativePath}`,
              url: `${process.env.APP_URL || 'http://localhost:3000'}/${relativePath}`
            });
          } catch (error) {
            // Clean up any uploaded files if there's an error
            for (const processedFile of processedFiles) {
              try {
                await fs.promises.unlink(path.join(process.cwd(), 'public', processedFile.path));
              } catch (e) {
                console.error('Error cleaning up file:', e);
              }
            }
            return next(new AppError(`Error processing file upload: ${error.message}`, 500));
          }
        }

        // Attach processed files to request object
        req.uploadedFiles = processedFiles;
        next();
      } catch (error) {
        next(error);
      }
    }
  ];
};

/**
 * Middleware to delete an uploaded file
 * @param {string} filePath - Path or URL of the file to delete
 * @returns {Function} Express middleware function
 */
const removeFile = (filePath) => async (req, res, next) => {
  try {
    if (req[filePath]) {
      const fullPath = path.join(process.cwd(), 'public', req[filePath]);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate file presence
 * @param {string} fieldName - The name of the file field
 * @returns {Function} Express middleware function
 */
const requireFile = (fieldName = 'files') => (req, res, next) => {
  if (!req.files || !req.files[fieldName]) {
    return next(new AppError(`Please upload a ${fieldName}`, 400));
  }
  next();
};

module.exports = {
  uploadFiles,
  removeFile,
  requireFile,
};
