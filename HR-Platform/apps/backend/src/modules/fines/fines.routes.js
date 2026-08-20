import express from 'express';
import Joi from 'joi';
import * as finesController from './fines.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateQuery, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { uploadFineFile, handleMulterError } from '../../shared/middleware/upload.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

const createFineTypeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
});

const templateSchema = Joi.object({
  violationType: Joi.string().valid('kech_kelish', 'erta_ketish', 'chiqish_yoq', 'kelmagan_kun').required(),
  timeLimit: Joi.string().max(5).allow('', null),
  amount: Joi.number().min(0).default(0),
  fineTypeId: Joi.string().uuid().allow('', null),
});

const policySchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  enabled: Joi.boolean().default(true),
  templates: Joi.array().items(templateSchema).default([]),
  employeeIds: Joi.array().items(commonSchemas.uuid).default([]),
});

const listAssignedFinesQuerySchema = Joi.object({
  employeeId: Joi.string().uuid().allow('').optional(),
  branches: Joi.string().allow('').optional(),
  departments: Joi.string().allow('').optional(),
  positions: Joi.string().allow('').optional(),
  scheduleIds: Joi.string().allow('').optional(),
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').optional(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').optional(),
});

const createAssignedFineSchema = Joi.object({
  employeeId: commonSchemas.uuid,
  amount: Joi.number().positive().required(),
  fineTypeId: Joi.string().uuid().allow('', null),
  note: Joi.string().max(500).allow('', null),
});

const punishmentStatusSchema = Joi.object({
  status: Joi.string().valid('bajarildi', 'bajarilmadi').required(),
  note: Joi.string().trim().min(1).max(1000).required(),
});

const listAppealsQuerySchema = Joi.object({
  status: Joi.string().valid('kutilmoqda', 'tasdiqlandi', 'rad_etildi').optional(),
});

const reviewAppealSchema = Joi.object({
  status: Joi.string().valid('tasdiqlandi', 'rad_etildi').required(),
  note: Joi.string().trim().max(1000).allow('', null),
});

const uuidParamSchema = Joi.object({ id: commonSchemas.uuid });
const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

// "Jazo turi" katalogi
router.get('/types', authenticate, canManage, finesController.getFineTypes);
router.post('/types', authenticate, canManage, validate(createFineTypeSchema), finesController.createFineType);
router.delete(
  '/types/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  finesController.deleteFineType
);

// "Jarima" siyosatlari
router.get('/policies', authenticate, canManage, finesController.getFinePolicies);
router.get('/policies/:id', authenticate, canManage, validateParams(uuidParamSchema), finesController.getFinePolicyById);
router.post('/policies', authenticate, canManage, validate(policySchema), finesController.createFinePolicy);
router.put(
  '/policies/:id',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(policySchema),
  finesController.updateFinePolicy
);
router.delete(
  '/policies/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  finesController.deleteFinePolicy
);

// Xodimga tayinlangan (haqiqatan tortilgan) jarimalar
router.get('/assigned', authenticate, canManage, validateQuery(listAssignedFinesQuerySchema), finesController.getAssignedFines);
router.post(
  '/assigned',
  authenticate,
  canManage,
  uploadFineFile,
  handleMulterError,
  validate(createAssignedFineSchema),
  finesController.createAssignedFine
);
router.patch(
  '/assigned/:id/punishment',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(punishmentStatusSchema),
  finesController.updatePunishmentStatus
);
router.delete(
  '/assigned/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  finesController.deleteAssignedFine
);

// Xodim Telegram bot orqali yuborgan tushuntirish xatlari (apellatsiya)
router.get('/appeals', authenticate, canManage, validateQuery(listAppealsQuerySchema), finesController.getFineAppeals);
router.patch(
  '/appeals/:id/review',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(reviewAppealSchema),
  finesController.reviewFineAppeal
);
router.post(
  '/appeals/:id/forward-to-manager',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  finesController.forwardAppealToManager
);

export default router;
