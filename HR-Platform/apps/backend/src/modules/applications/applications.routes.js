import express from 'express';
import Joi from 'joi';
import * as applicationsController from './applications.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, validateQuery, commonSchemas } from '../../shared/middleware/validate.js';
import { USER_ROLES, APPLICATION_STATUS } from '../../config/constants.js';

const router = express.Router();

/**
 * Validation Schemas
 */

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(APPLICATION_STATUS))
    .required(),
  comment: Joi.string().max(500).optional().allow('', null),
  interviewDate: Joi.date().iso().optional().allow(null),
  sinovStartDate: Joi.date().iso().optional().allow(null),
  sinovEndDate: Joi.date().iso().optional().allow(null)
    .when('sinovStartDate', {
      is: Joi.date().required(),
      then: Joi.date().iso().min(Joi.ref('sinovStartDate'))
        .messages({ 'date.min': 'Sinov tugash sanasi boshlanish sanasidan oldin bo\'lishi mumkin emas' }),
    }),
});

const updateOrderSchema = Joi.object({
  orderIndex: Joi.number().integer().min(0).required(),
});

const updateApplicationSchema = Joi.object({
  position: Joi.string().max(200).optional().allow('', null),
  notes: Joi.string().max(1000).optional().allow('', null),
  assignedTo: commonSchemas.uuid.optional().allow(null),
}).min(1);

const uuidParamSchema = Joi.object({
  id: commonSchemas.uuid,
});

const applicationQuerySchema = Joi.object({
  status: Joi.string().valid(...Object.values(APPLICATION_STATUS)).optional(),
  assignedTo: commonSchemas.uuid.optional(),
  search: Joi.string().max(100).optional(),
});

/**
 * Routes
 */

// GET /api/v1/applications - Get all applications (HR, ADMIN)
router.get(
  '/',
  authenticate,
  authorize(USER_ROLES.HR, USER_ROLES.ADMIN),
  validateQuery(applicationQuerySchema),
  applicationsController.getAllApplications
);

// GET /api/v1/applications/:id - Get application by ID (HR, ADMIN)
router.get(
  '/:id',
  authenticate,
  authorize(USER_ROLES.HR, USER_ROLES.ADMIN),
  validateParams(uuidParamSchema),
  applicationsController.getApplicationById
);

// PATCH /api/v1/applications/:id/status - Update status (HR, ADMIN)
router.patch(
  '/:id/status',
  authenticate,
  authorize(USER_ROLES.HR, USER_ROLES.ADMIN),
  validateParams(uuidParamSchema),
  validate(updateStatusSchema),
  applicationsController.updateApplicationStatus
);

// PATCH /api/v1/applications/:id/order - Update order (HR, ADMIN)
router.patch(
  '/:id/order',
  authenticate,
  authorize(USER_ROLES.HR, USER_ROLES.ADMIN),
  validateParams(uuidParamSchema),
  validate(updateOrderSchema),
  applicationsController.updateApplicationOrder
);

// PUT /api/v1/applications/:id - Update application (HR, ADMIN)
router.put(
  '/:id',
  authenticate,
  authorize(USER_ROLES.HR, USER_ROLES.ADMIN),
  validateParams(uuidParamSchema),
  validate(updateApplicationSchema),
  applicationsController.updateApplication
);

// GET /api/v1/applications/:id/history - Get history (HR, ADMIN)
router.get(
  '/:id/history',
  authenticate,
  authorize(USER_ROLES.HR, USER_ROLES.ADMIN),
  validateParams(uuidParamSchema),
  applicationsController.getApplicationHistory
);

export default router;
