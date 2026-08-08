import express from 'express';
import Joi from 'joi';
import * as onboardingController from './onboarding.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { uploadOnboardingDocument, handleMulterError } from '../../shared/middleware/upload.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

// Bare 11-char video ID or a full youtube.com/youtu.be URL only — anything
// else (a random link, a different video host) is rejected outright.
const YOUTUBE_URL_PATTERN = /^([a-zA-Z0-9_-]{11}|https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}(&\S*|\?\S*)?)$/;

const taskSchema = Joi.object({
  type: Joi.string().valid('video', 'hujjat', 'harakat').default('video'),
  title: Joi.string().trim().min(1).max(200).required(),
  videoUrl: Joi.string().trim().max(500).allow('', null).pattern(YOUTUBE_URL_PATTERN).messages({
    'string.pattern.base': 'Faqat YouTube havolasi yoki video ID qabul qilinadi',
  }),
  documentUrl: Joi.string().trim().max(500).allow('', null),
  documentName: Joi.string().trim().max(255).allow('', null),
  description: Joi.string().trim().max(2000).allow('', null),
});

const stepSchema = Joi.object({
  tasks: Joi.array().items(taskSchema).default([]),
});

const planSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).allow('', null),
  steps: Joi.array().items(stepSchema).default([]),
});

const assignmentSchema = Joi.object({
  planId: commonSchemas.uuid.required(),
  employeeId: commonSchemas.uuid.required(),
});

const toggleSchema = Joi.object({
  completed: Joi.boolean().required(),
});

const uuidParamSchema = Joi.object({ id: commonSchemas.uuid });
const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

// Hujjat yuklash (admin/HR) - "Hujjat" turidagi vazifalar uchun
router.post(
  '/documents',
  authenticate,
  canManage,
  uploadOnboardingDocument,
  handleMulterError,
  onboardingController.uploadDocument
);

// Statistika (admin/HR)
router.get('/stats', authenticate, canManage, onboardingController.getStats);

// Rejalar (admin/HR)
router.get('/plans', authenticate, canManage, onboardingController.getPlans);
router.get('/plans/:id', authenticate, canManage, validateParams(uuidParamSchema), onboardingController.getPlanById);
router.post('/plans', authenticate, canManage, validate(planSchema), onboardingController.createPlan);
router.put(
  '/plans/:id',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(planSchema),
  onboardingController.updatePlan
);
router.delete(
  '/plans/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  onboardingController.deletePlan
);

// Biriktirishlar (admin/HR)
router.get('/assignments', authenticate, canManage, onboardingController.getAssignments);
router.post('/assignments', authenticate, canManage, validate(assignmentSchema), onboardingController.createAssignment);
router.delete(
  '/assignments/:id',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  onboardingController.deleteAssignment
);

// Ommaviy (login talab qilinmaydi - xodim shaxsiy token orqali kiradi)
router.get('/public/:token', onboardingController.getPublicAssignment);
router.post('/public/:token/tasks/:taskId', validate(toggleSchema), onboardingController.toggleStep);

export default router;
