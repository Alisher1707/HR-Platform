import express from 'express';
import Joi from 'joi';
import * as onboardingController from './onboarding.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

const stepSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).allow('', null),
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
router.post('/public/:token/steps/:stepId', validate(toggleSchema), onboardingController.toggleStep);

export default router;
