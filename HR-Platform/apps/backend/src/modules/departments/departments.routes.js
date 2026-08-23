import express from 'express';
import Joi from 'joi';
import * as departmentsController from './departments.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

const departmentBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
});

const uuidParamSchema = Joi.object({ id: commonSchemas.uuid });

const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);
// O'chirish — boshqa bo'lim/reja atamalariga o'xshab, faqat Admin/Super Admin.
const canDelete = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN);

router.get('/', authenticate, canManage, departmentsController.getDepartments);
router.post('/', authenticate, canManage, validate(departmentBodySchema), departmentsController.createDepartment);
router.put(
  '/:id',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(departmentBodySchema),
  departmentsController.updateDepartment
);
router.delete('/:id', authenticate, canDelete, validateParams(uuidParamSchema), departmentsController.deleteDepartment);

export default router;
