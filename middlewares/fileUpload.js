const path = require('path');
const fs = require('fs');
const AppError = require('../utils/appError');
const storage = require('../config/storage');
const logger = require('../utils/logger');

// File validation function
const validateFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError(`Invalid file type: ${file.mimetype}. Only images are allowed.`, 400);
  }

  if (file.size > maxSize) {
    throw new AppError("File too large. Maximum size is 10MB.", 400);
  }

  return true;
};

// Generate unique filename
const generateUniqueFilename = (originalName, fieldname) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(originalName).toLowerCase();
  return `${fieldname}-${uniqueSuffix}${ext}`;
};

// Middleware factory function
const uploadFiles = (fieldName = 'files', maxCount = 11, diskName = 'local') => {
  return async (req, res, next) => {
    try {
      // DEBUG: Log file upload eligibility check
      // console.log("=== FILE UPLOAD ELIGIBILITY DEBUG ===");
      // console.log("Request method:", req.method);
      console.log("Request path:", req.originalUrl);
      console.log("Field name:", fieldName);
      console.log("Max count:", maxCount);
      console.log("Disk name:", diskName);
      console.log("Has req.files:", !!req.files);
      console.log("Files object keys:", req.files ? Object.keys(req.files) : "N/A");
      console.log("=====================================");

      // Set timeout to prevent hanging
      req.setTimeout(30000);

      // Initialize uploadedFiles array as empty array
      req.uploadedFiles = [];

      // Check if files exist
      if (!req.files) {
        console.log("No files found, continuing without upload processing");
        return next();
      }

      // Get the files (could be single file or array)
      let files = req.files[fieldName];

      if (!files) {
        return next();
      }

      // Ensure files is always an array
      if (!Array.isArray(files)) {
        files = [files];
      }

      // Check file count limit
      if (files.length > maxCount) {
        return next(new AppError("Maximum files are allowed.", 400));
      }

      // Get the appropriate disk configuration
      const disk = storage.getDisk(diskName);
      if (!disk) {
        return next(new AppError("Invalid storage disk.", 400));
      }

      // Process and save files
      for (const file of files) {
        try {
          // Skip if no file was uploaded for this field (for optional fields)
          if (!file || !file.name) continue;

          // Validate file
          validateFile(file);

          const filename = generateUniqueFilename(file.name, fieldName);
          const uploadDir = path.join(process.cwd(), disk.root);
          const filepath = path.join(uploadDir, filename);

          // Create upload directory if it doesn't exist
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          // Move file to destination
          await file.mv(filepath);

          // Add file info to request
          const relativePath = `${disk.url}/${filename}`;
          
          logger.info('File URL generation debug:', {
            diskUrl: disk.url,
            filename,
            relativePath,
            diskName
          });
          
          const fileInfo = {
            fieldname: fieldName,
            originalname: file.name,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: file.size,
            destination: uploadDir,
            filename: filename,
            path: filepath,
            url: relativePath
          };

          logger.info('File uploaded successfully:', {
            fieldname: fileInfo.fieldname,
            path: fileInfo.path,
            url: fileInfo.url,
            size: fileInfo.size
          });

          req.uploadedFiles.push(fileInfo);
        } catch (error) {
          // Clean up any uploaded files if one fails
          if (req.uploadedFiles && req.uploadedFiles.length > 0) {
            req.uploadedFiles.forEach(uploadedFile => {
              try {
                if (fs.existsSync(uploadedFile.path)) {
                  fs.unlinkSync(uploadedFile.path);
                }
              } catch (e) {
                logger.warn(`File cleanup skipped due to lock: ${uploadedFile.path}`);
              }
            });
          }
          return next(error);
        }
      }

      logger.info('Files uploaded successfully:', {
        count: req.uploadedFiles.length,
        files: req.uploadedFiles.map(f => ({ name: f.filename, size: f.size, url: f.url }))
      });

      next();
    } catch (error) {
      logger.error('File upload middleware error:', error);
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError("File upload error.", 400));
    }
  };
};

// Journal-specific upload middleware
const uploadJournalImages = (fieldName = 'featured_images', maxCount = 10) => {
  return uploadFiles(fieldName, maxCount, 'journal-images');
};

module.exports = uploadFiles;
module.exports.uploadJournalImages = uploadJournalImages;
