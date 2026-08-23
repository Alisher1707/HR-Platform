import express from 'express';
import Joi from 'joi';
import * as departmentsController from './departments.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

const createDepartmentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
});

const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

router.get('/', authenticate, canManage, departmentsController.getDepartments);
router.post('/', authenticate, canManage, validate(createDepartmentSchema), departmentsController.createDepartment);

export default router;
