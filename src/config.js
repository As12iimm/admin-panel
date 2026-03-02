require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8080,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/goodhope_admin',
  jwtSecret: process.env.JWT_SECRET || 'change-me-super-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h'
};
