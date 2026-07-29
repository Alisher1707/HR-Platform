import express from 'express';
import Joi from 'joi';
import * as inviteController from './invite.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, validateQuery, commonSchemas } from '../../shared/middleware/validate.js';
import { uploadResume, handleMulterError } from '../../shared/middleware/upload.js';
import { inviteLimiter } from '../../shared/middleware/rateLimiter.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

/**
 * Validation Schemas
 */

const createInviteSchema = Joi.object({
  position: Joi.string().max(200).optional().allow('', null),
  requirements: Joi.array().items(Joi.string()).optional().allow(null),
});

const uuidParamSchema = Joi.object({
  id: commonSchemas.uuid,
});

const tokenParamSchema = Joi.object({
  token: Joi.string().length(64).required(),
});

const inviteQuerySchema = Joi.object({
  isActive: Joi.boolean(),
  createdBy: commonSchemas.uuid.optional(),
});

const applyInviteSchema = Joi.object({
  token: Joi.string().length(64).required(),
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  phone: Joi.string().max(20).required(),
  birthDate: Joi.date().required(),
  experience: Joi.number().integer().min(0).max(50).required(),
  address: Joi.string().max(500).allow('', null).optional(),
  telegramUsername: Joi.string().max(100).allow('', null).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
});

/**
 * Routes
 */

// POST /api/v1/invites/apply - Candidate application (public, multipart: resume file)
router.post(
  '/apply',
  uploadResume,
  handleMulterError,
  validate(applyInviteSchema),
  inviteController.submitApplication
);

// POST /api/v1/invites - Create new invite (SUPER_ADMIN, HR)
router.post(
  '/',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  inviteLimiter,
  validate(createInviteSchema),
  inviteController.createInvite
);

// GET /api/v1/invites - Get all invites (SUPER_ADMIN, HR)
router.get(
  '/',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  validateQuery(inviteQuerySchema),
  inviteController.getAllInvites
);

// GET /api/v1/invites/validate/:token - Validate token (public)
router.get(
  '/validate/:token',
  validateParams(tokenParamSchema),
  inviteController.validateToken
);

// GET /api/v1/invites/:id - Get invite by ID (SUPER_ADMIN, HR)
router.get(
  '/:id',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  validateParams(uuidParamSchema),
  inviteController.getInviteById
);

// PATCH /api/v1/invites/:id/deactivate - Deactivate invite (SUPER_ADMIN, HR)
router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  validateParams(uuidParamSchema),
  inviteController.deactivateInvite
);

// DELETE /api/v1/invites/:id - Delete invite (SUPER_ADMIN only)
router.delete(
  '/:id',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  inviteController.deleteInvite
);

export default router;
