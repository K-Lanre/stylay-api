const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3 } = require('aws-sdk');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const AppError = require('./appError');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new AppError('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.', 400);
    return cb(error, false);
  }
  cb(null, true);
};

// Helper function to create directory if it doesn't exist
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

/**
 * Create a storage configuration with dynamic folder structure
 * @param {Object} options - Configuration options
 * @param {string|Function} options.folderStructure - Folder structure template or function that returns path
 * @param {string} [options.baseDir=''] - Base directory to prepend to all paths
 * @returns {Object} Multer storage configuration
 */
const createStorage = (options = {}) => {
  const { folderStructure, baseDir = '' } = options;
  
  return {
    destination: (req, file, cb) => {
      try {
        let relativePath = '';
        
        if (typeof folderStructure === 'function') {
          relativePath = folderStructure(req, file);
        } else if (typeof folderStructure === 'string') {
          // Replace placeholders like :field, :date, :userId, etc.
          relativePath = folderStructure
            .replace(/:field/g, file.fieldname)
            .replace(/:date/g, new Date().toISOString().split('T')[0])
            .replace(/:userId/g, req.user?.id || 'anonymous');
        } else {
          // Default structure: uploads/{fieldname}/YYYY-MM-DD
          const date = new Date().toISOString().split('T')[0];
          relativePath = `${file.fieldname}/${date}`;
        }
        
        const fullPath = path.join(uploadDir, baseDir, relativePath);
        ensureDirectoryExists(fullPath);
        cb(null, fullPath);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const originalName = path.basename(file.originalname, ext);
      cb(null, `${originalName}-${uniqueSuffix}${ext}`);
    }
  };
};

// Default storage configuration
const defaultStorage = multer.diskStorage(createStorage());

// S3 Configuration
let s3;
if (process.env.AWS_ACCESS_KEY_ID) {
  s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });
}

// Create S3 storage with dynamic folder structure
const createS3Storage = (options = {}) => {
  if (!s3) return null;
  
  const { folderStructure = 'uploads/:field/:date' } = options;
  
  return multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'public-read',
    metadata: (req, file, cb) => {
      cb(null, { 
        fieldName: file.fieldname,
        originalName: file.originalname,
        mimeType: file.mimetype
      });
    },
    key: (req, file, cb) => {
      try {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const originalName = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
        
        // Generate dynamic path
        let s3Path = '';
        if (typeof folderStructure === 'function') {
          s3Path = folderStructure(req, file);
        } else {
          s3Path = folderStructure
            .replace(/:field/g, file.fieldname)
            .replace(/:date/g, new Date().toISOString().split('T')[0])
            .replace(/:userId/g, req.user?.id || 'anonymous');
        }
        
        // Ensure path ends with a slash
        if (!s3Path.endsWith('/')) s3Path += '/';
        
        cb(null, `${s3Path}${originalName}-${uniqueSuffix}${ext}`);
      } catch (error) {
        cb(error);
      }
    },
  });
};

const s3Storage = s3 ? createS3Storage() : null;

// Create storage based on environment
const createDynamicStorage = (options = {}) => {
  if (s3) {
    return createS3Storage(options);
  }
  return multer.diskStorage(createStorage(options));
};

// Default storage (can be overridden when creating upload middleware)
const storage = s3Storage || defaultStorage;

// Create upload middleware with custom configuration
const createUploader = (options = {}) => {
  const {
    fieldName = 'file',
    maxCount = 1,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    maxSize = 5 * 1024 * 1024, // 5MB
    folderStructure = 'uploads/:field/:date',
    multiple = false,
    ...otherOptions
  } = options;
  
  const storageConfig = s3 
    ? createS3Storage({ folderStructure, ...otherOptions.s3Options })
    : multer.diskStorage(createStorage({ folderStructure, ...otherOptions.localOptions }));
  
  const fileFilter = (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new AppError(`Invalid file type. Only ${allowedTypes.join(', ')} are allowed.`, 400));
    }
    cb(null, true);
  };
  
  const limits = {
    fileSize: maxSize,
    files: multiple ? maxCount : 1,
    ...otherOptions.limits
  };
  
  const uploader = multer({
    storage: storageConfig,
    fileFilter,
    limits
  });
  
  if (multiple) {
    return (req, res, next) => {
      uploader.array(fieldName, maxCount)(req, res, (err) => {
        if (err) {
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new AppError(`Unexpected field: ${err.field}. Please check the field name.`, 400));
          }
          return next(err);
        }
        next();
      });
    };
  }
  
  return uploader.single(fieldName);
};

// Base upload middleware (maintains backward compatibility)
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Single file upload
const uploadSingle = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size is too large. Maximum size is 5MB.', 400));
      }
      return next(err);
    }
    next();
  });
};

// Multiple files upload
const uploadMultiple = (fieldName, maxCount = 5) => (req, res, next) => {
  upload.array(fieldName, maxCount)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size is too large. Maximum size is 5MB.', 400));
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError(`Maximum ${maxCount} files are allowed.`, 400));
      }
      return next(err);
    }
    next();
  });
};

// Delete file from storage
const deleteFile = (filePath) => {
  // If using S3
  if (filePath.startsWith('http') || filePath.startsWith('https')) {
    const key = filePath.split('/').slice(-2).join('/');
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    };
    
    return s3.deleteObject(params).promise()
      .catch(err => console.error('Error deleting file from S3:', err));
  }
  
  // If using local storage
  const fullPath = path.join(__dirname, '../public', filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  }
};

// Export the factory function and other utilities
module.exports = {
  // Factory function for creating upload middleware
  createUploader,
  
  // Backward compatibility (deprecated)
  uploadSingle: (fieldName) => createUploader({ fieldName }),
  uploadMultiple: (fieldName, maxCount) => createUploader({ fieldName, maxCount }),
  
  // Utility functions
  deleteFile,
  
  // Storage creators (for advanced usage)
  createStorage,
  createS3Storage,
  createDynamicStorage
};
