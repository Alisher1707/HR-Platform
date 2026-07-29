import express from 'express';
import Joi from 'joi';
import * as attendanceController from './attendance.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateQuery, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

/**
 * Validation Schemas
 */

const attendanceQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employeeId: commonSchemas.uuid.optional(),
});

const createAttendanceSchema = Joi.object({
  employeeId: commonSchemas.uuid,
  type: Joi.string().valid('keldi', 'ketdi').required(),
  recordedAt: Joi.date().required(),
  notes: Joi.string().max(1000).allow('', null).optional(),
});

const uuidParamSchema = Joi.object({
  id: commonSchemas.uuid,
});

/**
 * Routes
 */

// GET /api/v1/attendance - List attendance records (ADMIN, SUPER_ADMIN, HR)
router.get(
  '/',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  validateQuery(attendanceQuerySchema),
  attendanceController.getAttendance
);

// POST /api/v1/attendance - Create manual attendance record (ADMIN, SUPER_ADMIN, HR)
router.post(
  '/',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  validate(createAttendanceSchema),
  attendanceController.createAttendance
);

// DELETE /api/v1/attendance/:id - Delete a manual attendance record (ADMIN, SUPER_ADMIN only)
router.delete(
  '/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  attendanceController.deleteAttendance
);

export default router;
