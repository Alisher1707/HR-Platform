import { verifyAccessToken } from '../../shared/utils/token.js';
import { errorResponse } from '../../shared/utils/response.js';
import { HTTP_STATUS, MESSAGES, USER_ROLES } from '../../config/constants.js';
import { query } from '../../config/database.js';

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export async function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const result = await query(
      'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, MESSAGES.USER_NOT_FOUND, HTTP_STATUS.UNAUTHORIZED);
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return errorResponse(res, 'Account is deactivated', HTTP_STATUS.FORBIDDEN);
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.message === 'Access token expired') {
      return errorResponse(res, MESSAGES.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);
    }
    if (error.message === 'Invalid access token') {
      return errorResponse(res, MESSAGES.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }
    return errorResponse(res, MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
  }
}

/**
 * Authorization Middleware
 * Checks if user has required role(s)
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }

    // Bypass check for SUPER_ADMIN role
    if (req.user.role === USER_ROLES.SUPER_ADMIN) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access forbidden. Required role(s): ${allowedRoles.join(', ')}`,
        HTTP_STATUS.FORBIDDEN
      );
    }

    next();
  };
}

/**
 * Authentication from Query Parameter
 * For file downloads where token is passed in URL query param
 */
export async function authenticateFromQuery(req, res, next) {
  try {
    // Get token from query parameter
    const token = req.query.token;

    if (!token) {
      return errorResponse(res, MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const result = await query(
      'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, MESSAGES.USER_NOT_FOUND, HTTP_STATUS.UNAUTHORIZED);
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return errorResponse(res, 'Account is deactivated', HTTP_STATUS.FORBIDDEN);
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.message === 'Access token expired') {
      return errorResponse(res, MESSAGES.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);
    }
    if (error.message === 'Invalid access token') {
      return errorResponse(res, MESSAGES.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }
    return errorResponse(res, MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
  }
}

/**
 * Optional Authentication
 * Attaches user if token is valid, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);

      const result = await query(
        'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length > 0 && result.rows[0].is_active) {
        req.user = result.rows[0];
      }
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
}
