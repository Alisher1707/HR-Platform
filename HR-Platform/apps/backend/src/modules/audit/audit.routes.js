import express from 'express';
import Joi from 'joi';
import * as auditController from './audit.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validateQuery, commonSchemas } from '../../shared/middleware/validate.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

// Audit jurnalining o'zi imtiyozli amallar haqida — shuning uchun uni
// ko'rish ham eng yuqori imtiyoz talab qiladi. ADMIN/HR emas, faqat
// SUPER_ADMIN. (SUPER_ADMIN o'z bypass'larini ko'radi — bu kutilgan,
// jurnal shaffofligi shu tarzda ishlaydi: hech kim o'ziga ko'rinmas
// bo'la olmaydi.)
const auditLogQuerySchema = Joi.object({
  action: Joi.string().max(100).optional(),
  actorUserId: commonSchemas.uuid.optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

// GET /api/v1/audit-logs - Imtiyozli amallar jurnali (SUPER_ADMIN only)
router.get(
  '/',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN),
  validateQuery(auditLogQuerySchema),
  auditController.getAuditLogs
);

export default router;
