import { asyncHandler } from '../../shared/middleware/errorHandler.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { COOKIE_OPTIONS, MESSAGES } from '../../config/constants.js';
import * as authService from './auth.service.js';

/**
 * Auth Controller
 * Handles HTTP requests for authentication
 */

/**
 * POST /api/v1/auth/login
 * User login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, tokens } = await authService.loginUser(email, password);

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

  return successResponse(res, {
    user,
    accessToken: tokens.accessToken,
  }, MESSAGES.AUTH_SUCCESS);
});

/**
 * POST /api/v1/auth/register
 * Register user with invite token
 */
export const register = asyncHandler(async (req, res) => {
  const { token, email, password, firstName, lastName } = req.body;

  const { user, tokens } = await authService.registerUser(token, {
    email,
    password,
    firstName,
    lastName,
  });

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

  return successResponse(res, {
    user,
    accessToken: tokens.accessToken,
  }, MESSAGES.USER_CREATED, 201);
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return errorResponse(res, 'Refresh token not found', 401);
  }

  const tokens = await authService.refreshAccessToken(refreshToken);

  // Update refresh token cookie
  res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

  return successResponse(res, {
    accessToken: tokens.accessToken,
  }, 'Token refreshed successfully');
});

/**
 * POST /api/v1/auth/logout
 * Logout user — revokes the refresh token itself (see auth.service.js),
 * not just the cookie carrying it. Clearing only the cookie left the
 * token cryptographically valid for up to 7 more days; anyone who'd
 * copied it (XSS, a shared/compromised machine) could keep using it long
 * after the user believed they'd logged out.
 */
export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.cookies.refreshToken, req.user.id);

  res.clearCookie('refreshToken');

  return successResponse(res, null, 'Logged out successfully');
});

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);

  return successResponse(res, { user }, 'User retrieved successfully');
});

/**
 * PATCH /api/v1/auth/password
 * Change own password — XAVFSIZLIK-AUDIT.md O-9. Clears the refresh
 * cookie too: every refresh token was just revoked server-side
 * (auth.service#changePassword), so the cookie is already dead weight and
 * the client must log in again with the new password.
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword(req.user.id, currentPassword, newPassword);

  res.clearCookie('refreshToken');

  return successResponse(res, null, "Parol muvaffaqiyatli almashtirildi. Iltimos, qayta kiring.");
});
