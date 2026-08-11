import express from 'express';
import Joi from 'joi';
import * as schedulesController from './schedules.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayConfigSchema = Joi.object({
  dayNumber: Joi.number().integer().min(1).required(),
  isWorkDay: Joi.boolean().required(),
  startTime: Joi.string().pattern(TIME_PATTERN).allow('', null),
  endTime: Joi.string().pattern(TIME_PATTERN).allow('', null),
  breakStart: Joi.string().pattern(TIME_PATTERN).allow('', null),
  breakEnd: Joi.string().pattern(TIME_PATTERN).allow('', null),
});

const scheduleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  type: Joi.string().valid('moslashuvchan', 'gibrid', 'erkin').required(),
  startDate: Joi.date().required(),
  cycleDays: Joi.number().integer().min(1).max(31).default(7),
  countOvertime: Joi.boolean().default(false),
  deductBreak: Joi.boolean().default(false),
  extendedHours: Joi.number().integer().min(0).max(24).default(0),
  limitType: Joi.string().valid('kunlik', 'haftalik', 'oylik').allow('', null),
  // 744 = 31 kunlik oyning soat soni — "Oylik" limit uchun yetadigan yuqori
  // chegara; "Kunlik"/"Haftalik" bunchalik katta qiymat kiritmaydi, lekin
  // bitta umumiy chegara oddiyroq va baribir mazmunsiz qiymatlarni to'sadi.
  limitHours: Joi.number().integer().min(0).max(744).allow(null),
  shiftLimitHours: Joi.number().integer().min(0).max(24).allow(null),
  // "Moslashuvchan" sikl davomida har bir kunning o'z vaqti bilan sozlanadi
  // (kamida 1 kun shart). "Gibrid"/"Erkin"da qat'iy vaqt tushunchasi yo'q —
  // ular limit-asosli, shuning uchun kunlar ro'yxati bo'sh bo'lishi mumkin.
  days: Joi.when('type', {
    is: 'moslashuvchan',
    then: Joi.array().items(dayConfigSchema).min(1).required(),
    otherwise: Joi.array().items(dayConfigSchema).min(0).default([]),
  }),
  employeeIds: Joi.array().items(commonSchemas.uuid).min(1).required(),
});

const uuidParamSchema = Joi.object({ id: commonSchemas.uuid });
const employeeIdParamSchema = Joi.object({ employeeId: commonSchemas.uuid });
const assignScheduleSchema = Joi.object({ scheduleId: Joi.string().uuid().allow(null).required() });

const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

// GET /api/v1/schedules - List all schedules
router.get('/', authenticate, canManage, schedulesController.getSchedules);

// GET /api/v1/schedules/:id
router.get('/:id', authenticate, canManage, validateParams(uuidParamSchema), schedulesController.getScheduleById);

// POST /api/v1/schedules - Create a new schedule (assigns employees at the same time)
router.post('/', authenticate, canManage, validate(scheduleSchema), schedulesController.createSchedule);

// PUT /api/v1/schedules/:id - Update a schedule + its employee assignments
router.put(
  '/:id',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(scheduleSchema),
  schedulesController.updateSchedule
);

// PUT /api/v1/schedules/assignments/:employeeId - Assign/unassign a single
// employee to a schedule from the employee side (used by EmployeeForm's
// "Jadval" field). Body: { scheduleId: uuid|null }.
router.put(
  '/assignments/:employeeId',
  authenticate,
  canManage,
  validateParams(employeeIdParamSchema),
  validate(assignScheduleSchema),
  schedulesController.setEmployeeSchedule
);

// DELETE /api/v1/schedules/:id
router.delete(
  '/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  schedulesController.deleteSchedule
);

export default router;
