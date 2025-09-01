const path = require('path');
const fs = require('fs');
const AppError = require('../utils/appError');

// File validation function
const validateFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError(`Invalid file type: ${file.mimetype}. Only images are allowed.`, 400);
  }
  
  if (file.size > maxSize) {
    throw new AppError('File too large. Maximum size is 10MB.', 400);
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
const uploadFiles = (fieldName = 'files', maxCount = 11) => {
  return async (req, res, next) => {
    try {
      // Set timeout to prevent hanging
      req.setTimeout(30000);
      
      // Initialize uploadedFiles array if it doesn't exist
      if (!req.uploadedFiles) {
        req.uploadedFiles = [];
      }
      
      // Check if files exist
      if (!req.files) {
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
        return next(new AppError(`Maximum ${maxCount} files are allowed.`, 400));
      }
      
      // Determine upload folder
      const uploadFolder = req.vendorId || 'temp';
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'stores', uploadFolder);
      fs.mkdirSync(uploadDir, { recursive: true });
      
      // Process and save files
      for (const file of files) {
        try {
          // Skip if no file was uploaded for this field (for optional fields)
          if (!file || !file.name) continue;
          
          // Validate file
          validateFile(file);
          
          const filename = generateUniqueFilename(file.name, fieldName);
          const filepath = path.join(uploadDir, filename);
          
          // Create upload directory if it doesn't exist
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          
          // Move file to destination
          await file.mv(filepath);
          
          // Add file info to request
          const fileInfo = {
            fieldname: fieldName,
            originalname: file.name,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: file.size,
            destination: uploadDir,
            filename: filename,
            path: filepath,
            url: `${process.env.APP_URL || 'http://localhost:3000'}/uploads/stores/${uploadFolder}/${filename}`
          };
          
          // Initialize uploadedFiles array if it doesn't exist
          if (!req.uploadedFiles) {
            req.uploadedFiles = [];
          }
          
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
                console.error('Error cleaning up file:', e);
              }
            });
          }
          return next(error);
        }
      }
      
      next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError(`File upload error: ${error.message}`, 400));
    }
  };
};

module.exports = uploadFiles;
