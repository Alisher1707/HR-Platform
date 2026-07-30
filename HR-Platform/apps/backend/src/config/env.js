import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * Environment Configuration
 * Validates and exports all environment variables
 */
export const config = {
  // Server Configuration
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/hr_platform',
  },

  // JWT Configuration
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  // Invite Configuration
  invite: {
    expiresInDays: parseInt(process.env.INVITE_TOKEN_EXPIRES_DAYS || '7', 10),
  },
};

/**
 * Validate required environment variables
 */
export function validateEnv() {
  const required = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in the values.'
    );
  }

  // Validate JWT secrets length
  if (config.jwt.accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters long');
  }

  if (config.jwt.refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
  }

  console.log('✅ Environment variables validated successfully');
}
