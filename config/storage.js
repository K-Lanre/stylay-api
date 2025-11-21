require('dotenv').config();

const storage = {
  default: process.env.DEFAULT_STORAGE || 'local',
  uploadDir: 'Upload', // Define the upload directory

  disks: {
    local: {
      driver: 'local',
      root: process.env.LOCAL_STORAGE_ROOT || 'public', // Set root to public
      url: process.env.LOCAL_STORAGE_URL || '/', // Set base URL
      visibility: 'public',
    },
    
    'product-images': {
      driver: 'local',
      root: `public/Upload/product-images`,
      url: `/uploads/product-images`,
      visibility: 'public',
    },

    'vendor-assets': {
      driver: 'local',
      root: `public/Upload/vendor-assets`,
      url: `/uploads/vendor-assets`,
      visibility: 'public',
    },

    'store-files': {
      driver: 'local',
      root: `public/Upload/store-files`,
      url: `/uploads/store-files`,
      visibility: 'public',
    },

    'user-avatars': {
      driver: 'local',
      root: `public/Upload/user-avatars`,
      url: `/uploads/user-avatars`,
      visibility: 'public',
    },

    'journal-images': {
      driver: 'local',
      root: `public/Upload/journal-images`,
      url: `/uploads/journal-images`,
      visibility: 'public',
    },

    s3: {
      driver: 's3',
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_DEFAULT_REGION,
      bucket: process.env.AWS_BUCKET,
      url: process.env.AWS_URL,
      visibility: 'public',
    },
  },

  getDisk(diskName = this.default) {
    const disk = this.disks[diskName];
    if (!disk) {
      throw new Error(`Disk "${diskName}" not found in storage configuration.`);
    }
    return disk;
  },
};

module.exports = storage;