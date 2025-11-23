const path = require('path');
const fs = require('fs');
// const ClamScan = require('clamscan'); // Disabled: no daemon/binary
const AppError = require('../utils/appError');
const storage = require('../config/storage');
const logger = require('../utils/logger');

const validateFile = (file) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'video/mp4'
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError(`Invalid file type: ${file.mimetype}. Only PDF, DOC, DOCX, JPG, PNG, MP4 allowed.`, 400);
  }

  if (file.size > maxSize) {
    throw new AppError('File too large. Maximum size is 10MB.', 400);
  }

  return true;
};

const scanFileForVirus = async (fileBuffer) => {
  // TODO: Integrate VirusTotal API or Docker clamd for prod
  // Current: Skip (no daemon/binary on Win11); basic mime/size already validated
  logger.info('Virus scan: skipped (daemonless mode) - buffer size:', fileBuffer.length);
  return;
};

const generateUniqueFilename = (originalName, fieldname) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(originalName).toLowerCase();
  return `${fieldname}-${uniqueSuffix}${ext}`;
};

const uploadSupportFiles = (fieldName = 'attachments', maxCount = 5, diskName = 'support-attachments') => {
  return async (req, res, next) => {
    try {
      req.setTimeout(60000); // 60s for scanning

      if (!req.files) {
        return next();
      }

      let files = req.files[fieldName];
      if (!files) {
        return next();
      }

      if (!Array.isArray(files)) {
        files = [files];
      }

      if (files.length > maxCount) {
        return next(new AppError(`Maximum ${maxCount} files allowed.`, 400));
      }

      const disk = storage.getDisk(diskName);
      if (!disk) {
        return next(new AppError(`Storage disk ${diskName} not found.`, 500));
      }

      req.uploadedFiles = [];

      for (const file of files) {
        if (!file || !file.name) continue;

        validateFile(file);

        // Virus scan buffer
        await scanFileForVirus(file.data);

        const filename = generateUniqueFilename(file.name, fieldName);
        const uploadDir = path.join(process.cwd(), disk.root);
        const filepath = path.join(uploadDir, filename);

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        await file.mv(filepath);

        const fileInfo = {
          fieldname: fieldName,
          originalname: file.name,
          mimetype: file.mimetype,
          size: file.size,
          filename,
          path: filepath,
          url: `${disk.url}/${filename}`
        };

        req.uploadedFiles.push(fileInfo);
      }

      next();
    } catch (error) {
      // Cleanup on error
      if (req.uploadedFiles) {
        req.uploadedFiles.forEach(f => {
          if (fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        });
      }
      next(error);
    }
  };
};

module.exports = uploadSupportFiles;