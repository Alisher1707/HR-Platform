import express from 'express';
import Joi from 'joi';
import * as employeesController from './employees.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, validateQuery, commonSchemas } from '../../shared/middleware/validate.js';
import { uploadEmployeePhoto, uploadResume, handleMulterError } from '../../shared/middleware/upload.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

/**
 * Validation Schemas
 */

const createEmployeeSchema = Joi.object({
  employeeNumber: Joi.string().max(50).optional().allow('', null),
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  branch: Joi.string().max(100).optional().allow('', null),
  department: Joi.string().max(100).optional().allow('', null),
  position: Joi.string().max(200).optional().allow('', null),
  joinDate: commonSchemas.date.optional().allow('', null),
  birthDate: commonSchemas.date.optional().allow('', null),
  pnfl: Joi.string().length(14).optional().allow('', null),
  phone: commonSchemas.phone.optional().allow('', null),
  email: Joi.string().email().max(255).optional().allow('', null),
  telegramUsername: Joi.string().max(100).optional().allow('', null),
  address: Joi.string().max(500).optional().allow('', null),
  salaryType: Joi.string().max(50).optional().allow('', null),
  salaryAmount: Joi.number().min(0).optional().allow(null),
  status: Joi.string().max(50).optional().allow('', null),
  kpiTemplate: Joi.string().max(100).optional().allow('', null),
  experience: Joi.number().integer().min(0).max(100).default(0),
  notes: Joi.string().max(1000).optional().allow('', null),
  contractStartDate: commonSchemas.date.optional().allow('', null),
  contractEndDate: commonSchemas.date.optional().allow('', null),
  // personId is intentionally NOT accepted here — it's always auto-assigned
  // server-side (see employees.service.js#createEmployee), never client-set.
});

const updateEmployeeSchema = Joi.object({
  employeeNumber: Joi.string().max(50).optional().allow('', null),
  firstName: Joi.string().min(2).max(100),
  lastName: Joi.string().min(2).max(100),
  branch: Joi.string().max(100).optional().allow('', null),
  department: Joi.string().max(100).optional().allow('', null),
  position: Joi.string().max(200).optional().allow('', null),
  joinDate: commonSchemas.date.optional().allow('', null),
  birthDate: commonSchemas.date.optional().allow('', null),
  pnfl: Joi.string().length(14).optional().allow('', null),
  phone: commonSchemas.phone.optional().allow('', null),
  email: Joi.string().email().max(255).optional().allow('', null),
  telegramUsername: Joi.string().max(100).optional().allow('', null),
  address: Joi.string().max(500).optional().allow('', null),
  salaryType: Joi.string().max(50).optional().allow('', null),
  salaryAmount: Joi.number().min(0).optional().allow(null),
  status: Joi.string().max(50).optional().allow('', null),
  kpiTemplate: Joi.string().max(100).optional().allow('', null),
  experience: Joi.number().integer().min(0).max(100),
  contractStartDate: commonSchemas.date.optional().allow('', null),
  contractEndDate: commonSchemas.date.optional().allow('', null),
  // person_id is not editable — see createEmployeeSchema comment above.
}).min(1); // At least one field required

const uuidParamSchema = Joi.object({
  id: commonSchemas.uuid,
});

const employeeQuerySchema = Joi.object({
  search: Joi.string().max(100).optional(),
  createdBy: commonSchemas.uuid.optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Import qatori — createEmployeeSchema'ning yumshoqroq varianti. Excel'dagi
// bo'sh katak ko'pincha '' bo'lib keladi, shuning uchun deyarli hamma
// maydon allow('', null). Faqat ism va familiya majburiy: qolganini HR
// keyin to'ldirishi mumkin, lekin ismsiz qator umuman ma'nosiz.
// rowNumber — foydalanuvchining Excel faylidagi qator raqami, xato
// xabarlarini o'sha qatorga bog'lash uchun (bazaga yozilmaydi).
const importRowSchema = Joi.object({
  rowNumber: Joi.number().integer().min(1).optional(),
  employeeNumber: Joi.string().max(50).allow('', null),
  firstName: Joi.string().trim().min(2).max(100).required(),
  lastName: Joi.string().trim().min(2).max(100).required(),
  branch: Joi.string().max(100).allow('', null),
  department: Joi.string().max(100).allow('', null),
  position: Joi.string().max(200).allow('', null),
  joinDate: commonSchemas.date.optional(),
  birthDate: commonSchemas.date.optional(),
  pnfl: Joi.string().length(14).allow('', null),
  phone: Joi.string().max(20).allow('', null),
  email: Joi.string().email().max(255).allow('', null),
  telegramUsername: Joi.string().max(100).allow('', null),
  address: Joi.string().max(500).allow('', null),
  salaryType: Joi.string().max(50).allow('', null),
  salaryAmount: Joi.number().min(0).allow(null),
  status: Joi.string().max(50).allow('', null),
  experience: Joi.number().integer().min(0).max(100).allow(null),
  contractStartDate: commonSchemas.date.optional(),
  contractEndDate: commonSchemas.date.optional(),
});

// 500 — bitta so'rovda oqilona chegara. Undan kattaroq ro'yxatni frontend
// bo'lib-bo'lib yuboradi, shunda ham so'rov timeout bo'lmaydi, ham
// foydalanuvchi jarayonni bosqichma-bosqich ko'radi.
const bulkImportSchema = Joi.object({
  employees: Joi.array().items(importRowSchema).min(1).max(500).required(),
});

/**
 * Routes
 */

// POST /api/v1/employees - Create employee (ADMIN, HR)
router.post(
  '/',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  validate(createEmployeeSchema),
  employeesController.createEmployee
);

// POST /api/v1/employees/bulk-import - Excel'dan ommaviy import (ADMIN, HR)
// Diqqat: '/:id' marshrutlaridan OLDIN turishi shart, aks holda Express
// 'bulk-import' ni :id parametri deb qabul qiladi.
router.post(
  '/bulk-import',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR),
  validate(bulkImportSchema),
  employeesController.bulkImportEmployees
);

// GET /api/v1/employees - Get all employees (ADMIN, HR)
router.get(
  '/',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.HR),
  validateQuery(employeeQuerySchema),
  employeesController.getAllEmployees
);

// GET /api/v1/employees/:id - Get employee by ID (ADMIN, HR)
router.get(
  '/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.HR),
  validateParams(uuidParamSchema),
  employeesController.getEmployeeById
);

// PUT /api/v1/employees/:id - Update employee (ADMIN, HR)
router.put(
  '/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.HR),
  validateParams(uuidParamSchema),
  validate(updateEmployeeSchema),
  employeesController.updateEmployee
);

// POST /api/v1/employees/:id/photo - Upload employee photo (ADMIN, HR)
router.post(
  '/:id/photo',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.HR),
  validateParams(uuidParamSchema),
  uploadEmployeePhoto,
  handleMulterError,
  employeesController.uploadPhoto
);

// POST /api/v1/employees/:id/resume - Upload employee resume (ADMIN, HR)
router.post(
  '/:id/resume',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.HR),
  validateParams(uuidParamSchema),
  uploadResume,
  handleMulterError,
  employeesController.uploadResume
);


// DELETE /api/v1/employees/:id - Delete employee (ADMIN only)
router.delete(
  '/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN),
  validateParams(uuidParamSchema),
  employeesController.deleteEmployee
);

export default router;
