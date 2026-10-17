import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/verifinder',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'verifinder_jwt_access_secret_super_secure_key_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'verifinder_jwt_refresh_secret_super_secure_key_2026',
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION || '1d',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:4200',
  API_URL: process.env.API_URL || 'http://localhost:5000/api',
};
