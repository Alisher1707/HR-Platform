/**
 * Application Constants
 * Centralized place for all constant values
 */

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
};

// Application Status for Kanban Board
export const APPLICATION_STATUS = {
  KELDI: 'KELDI',               // New application received
  QOSHILDI: 'QOSHILDI',         // Application accepted
  SINOV_MUDDATI: 'SINOV_MUDDATI', // Trial period
  SHARTNOMA: 'SHARTNOMA',       // Contract signed
  RAD_ETILDI: 'RAD_ETILDI',     // Application rejected
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

// API Response Messages
export const MESSAGES = {
  // Auth
  AUTH_SUCCESS: 'Authentication successful',
  AUTH_FAILED: 'Invalid credentials',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',

  // User
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
  USER_NOT_FOUND: 'User not found',
  USER_EXISTS: 'User already exists',

  // Invite
  INVITE_CREATED: 'Invite created successfully',
  INVITE_INVALID: 'Invalid or expired invite',
  INVITE_USED: 'Invite has already been used',
  INVITE_EXPIRED: 'Invite has expired',

  // Employee
  EMPLOYEE_CREATED: 'Employee created successfully',
  EMPLOYEE_UPDATED: 'Employee updated successfully',
  EMPLOYEE_NOT_FOUND: 'Employee not found',

  // Application
  APPLICATION_CREATED: 'Application created successfully',
  APPLICATION_UPDATED: 'Application updated successfully',
  APPLICATION_NOT_FOUND: 'Application not found',

  // General
  SUCCESS: 'Operation successful',
  ERROR: 'An error occurred',
  VALIDATION_ERROR: 'Validation error',
  SERVER_ERROR: 'Internal server error',
};

// Cookie Options
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

// Rate Limiting
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 600,
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};
