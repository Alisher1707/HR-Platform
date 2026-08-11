import express from 'express';
import Joi from 'joi';
import * as finesController from './fines.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
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

export default router;
