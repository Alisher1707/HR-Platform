import express from 'express';
import Joi from 'joi';
import * as payrollController from './payroll.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateQuery, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

const listPaymentsQuerySchema = Joi.object({
  employeeId: Joi.string().uuid().allow('').optional(),
  branches: Joi.string().allow('').optional(),
  departments: Joi.string().allow('').optional(),
  positions: Joi.string().allow('').optional(),
  scheduleIds: Joi.string().allow('').optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
  year: Joi.number().integer().optional(),
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').optional(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').optional(),
});

const createPaymentSchema = Joi.object({
  employeeId: commonSchemas.uuid,
  amount: Joi.number().positive().required(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  note: Joi.string().max(500).allow('', null),
});

const uuidParamSchema = Joi.object({ id: commonSchemas.uuid });
const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

router.get('/payments', authenticate, canManage, validateQuery(listPaymentsQuerySchema), payrollController.getPayments);
router.post('/payments', authenticate, canManage, validate(createPaymentSchema), payrollController.createPayment);
router.delete(
  '/payments/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  payrollController.deletePayment
);

export default router;
