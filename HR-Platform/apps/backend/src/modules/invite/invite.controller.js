import { asyncHandler } from '../../shared/middleware/errorHandler.js';
import { successResponse, createdResponse } from '../../shared/utils/response.js';
import { MESSAGES } from '../../config/constants.js';
import * as inviteService from './invite.service.js';

/**
 * Invite Controller
 * Handles HTTP requests for invite management
 */

/**
 * POST /api/v1/invites
 * Create new invite token
 */
export const createInvite = asyncHandler(async (req, res) => {
  const { position, requirements } = req.body;
  const invite = await inviteService.createInvite(req.user.id, position, requirements);

  return createdResponse(res, { invite }, MESSAGES.INVITE_CREATED);
});

/**
 * GET /api/v1/invites
 * Get all invites
 */
export const getAllInvites = asyncHandler(async (req, res) => {
  const filters = {
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    createdBy: req.query.createdBy,
  };

  const invites = await inviteService.getAllInvites(filters);

  return successResponse(res, { invites, total: invites.length }, 'Invites retrieved successfully');
});

/**
 * GET /api/v1/invites/:id
 * Get invite by ID
 */
export const getInviteById = asyncHandler(async (req, res) => {
  const invite = await inviteService.getInviteById(req.params.id);

  return successResponse(res, { invite }, 'Invite retrieved successfully');
});

/**
 * POST /api/v1/invites/apply
 * Submit candidate application using invite token
 */
export const submitApplication = asyncHandler(async (req, res) => {
  const result = await inviteService.submitApplication(req.body, req.file || null);

  return successResponse(res, result, 'Muvaffaqiyatli ariza topshirdingiz. Rahmat!', 201);
});

/**
 * GET /api/v1/invites/validate/:token
 * Validate invite token
 */
export const validateToken = asyncHandler(async (req, res) => {
  const validation = await inviteService.validateInviteToken(req.params.token);

  return successResponse(res, validation, validation.message);
});

/**
 * PATCH /api/v1/invites/:id/deactivate
 * Deactivate invite
 */
export const deactivateInvite = asyncHandler(async (req, res) => {
  const result = await inviteService.deactivateInvite(req.params.id);

  return successResponse(res, result, 'Invite deactivated successfully');
});

/**
 * DELETE /api/v1/invites/:id
 * Delete invite
 */
export const deleteInvite = asyncHandler(async (req, res) => {
  const result = await inviteService.deleteInvite(req.params.id);

  return successResponse(res, result, 'Invite deleted successfully');
});
