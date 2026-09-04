import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

/**
 * JWT Token Utilities
 * Helper functions for JWT token generation and verification
 */

/**
 * Generate access token (short-lived)
 */
/**
 * XAVFSIZLIK-AUDIT.md (4-pass, qattiqlashtirish): imzo va tekshiruv
 * algoritmi ochiq belgilanadi. jsonwebtoken@9 matnli kalit bilan
 * o'zi ham faqat HMAC'ni qabul qiladi (ya'ni `alg:none` va RS256'ga
 * almashtirish hujumlari allaqachon yopiq), lekin bu himoya kutubxona
 * STANDARTIGA bog'liq. Uni ochiq yozib qo'yish himoyani versiya
 * o'zgarishidan mustaqil qiladi — kutubxona standarti kelajakda
 * o'zgarsa ham, bu yerda qabul qilinadigan algoritm o'zgarmaydi.
 */
const JWT_ALGORITHM = 'HS256';

export function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
    algorithm: JWT_ALGORITHM,
  });
}

/**
 * Generate refresh token (long-lived)
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    algorithm: JWT_ALGORITHM,
  });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret, { algorithms: [JWT_ALGORITHM] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, { algorithms: [JWT_ALGORITHM] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token) {
  return jwt.decode(token);
}
