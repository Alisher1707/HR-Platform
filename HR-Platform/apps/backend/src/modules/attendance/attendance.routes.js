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
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employeeId: commonSchemas.uuid.optional(),
});

const attendanceReportQuerySchema = Joi.object({
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  branches: Joi.string().allow('').optional(),
  departments: Joi.string().allow('').optional(),
  positions: Joi.string().allow('').optional(),
  scheduleIds: Joi.string().allow('').optional(),
  employeeId: Joi.string().uuid().allow('').optional(),
});

const createAttendanceSchema = Joi.object({
  employeeId: commonSchemas.uuid,
  type: Joi.string().valid('keldi', 'ketdi').required(),
  // XAVFSIZLIK-AUDIT.md (6-pass, amaliy funksional audit, F4): hech qanday
  // chegara yo'q edi — jonli sinovda 2030-yil sanasi bilan "keldi" yozuvi
  // muammosiz qabul qilindi va hatto "kech qoldi" deb hisoblandi. Davomat —
  // ta'rifi bo'yicha ALLAQACHON sodir bo'lgan voqeani yozadi; "now" — Joi
  // tomonidan har bir so'rovda DINAMIK baholanadi (schema yuklanganda emas).
  recordedAt: Joi.date().max('now').required().messages({
    'date.max': "Davomat sanasi kelajakda bo'lishi mumkin emas",
  }),
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

// GET /api/v1/attendance/report - Per-employee attendance summary (ADMIN, SUPER_ADMIN, HR)
router.get(
  '/report',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  validateQuery(attendanceReportQuerySchema),
  attendanceController.getAttendanceReport
);

// GET /api/v1/attendance/department-summary - Bugungi kunning bo'lim kesimidagi holati (ADMIN, SUPER_ADMIN, HR)
router.get(
  '/department-summary',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  attendanceController.getDepartmentSummary
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
