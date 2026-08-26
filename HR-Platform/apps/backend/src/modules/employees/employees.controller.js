import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { asyncHandler } from '../../shared/middleware/errorHandler.js';
import { successResponse, createdResponse, paginatedResponse, errorResponse } from '../../shared/utils/response.js';
import { HTTP_STATUS, MESSAGES } from '../../config/constants.js';
import * as employeesService from './employees.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const employeePhotosDir = path.join(__dirname, '../../../uploads/employees');
const resumesDir = path.join(__dirname, '../../../uploads/resumes');

/**
 * Employees Controller
 * Handles HTTP requests for employee management
 */

/**
 * POST /api/v1/employees
 * Create new employee and application
 */
export const createEmployee = asyncHandler(async (req, res) => {
  const employeeData = {
    employeeNumber: req.body.employeeNumber,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    branch: req.body.branch,
    department: req.body.department,
    position: req.body.position,
    joinDate: req.body.joinDate,
    birthDate: req.body.birthDate,
    pnfl: req.body.pnfl,
    phone: req.body.phone,
    email: req.body.email,
    telegramUsername: req.body.telegramUsername,
    address: req.body.address,
    salaryType: req.body.salaryType,
    salaryAmount: req.body.salaryAmount,
    status: req.body.status,
    kpiTemplate: req.body.kpiTemplate,
    experience: req.body.experience,
    notes: req.body.notes,
    contractStartDate: req.body.contractStartDate,
    contractEndDate: req.body.contractEndDate,
    // personId intentionally omitted — always auto-assigned, see employees.service.js
  };

  const result = await employeesService.createEmployee(employeeData, req.user.id);

  return createdResponse(res, result, MESSAGES.EMPLOYEE_CREATED);
});

/**
 * POST /api/v1/employees/bulk-import
 * Excel'dan tayyorlangan xodimlar ro'yxatini bir yo'la yozadi. Fayl
 * brauzerda o'qilib, ustunlar moslashtirilgandan keyin bu yerga tayyor
 * JSON bo'lib keladi — server fayl formatlarini tahlil qilmaydi.
 */
export const bulkImportEmployees = asyncHandler(async (req, res) => {
  const result = await employeesService.bulkImportEmployees(req.body.employees, req.user.id);

  const summary = result.failed > 0
    ? `${result.imported} ta xodim qo'shildi, ${result.failed} ta qatorda xatolik`
    : `${result.imported} ta xodim muvaffaqiyatli qo'shildi`;

  return successResponse(res, result, summary);
});

/**
 * GET /api/v1/employees
 * Get all employees with pagination
 */
export const getAllEmployees = asyncHandler(async (req, res) => {
  const filters = {
    search: req.query.search,
    createdBy: req.query.createdBy,
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
  };

  const result = await employeesService.getAllEmployees(filters, pagination);

  return paginatedResponse(res, result.employees, result.pagination, 'Employees retrieved successfully');
});

/**
 * GET /api/v1/employees/:id
 * Get employee by ID
 */
export const getEmployeeById = asyncHandler(async (req, res) => {
  const employee = await employeesService.getEmployeeById(req.params.id);

  return successResponse(res, { employee }, 'Employee retrieved successfully');
});

/**
 * PUT /api/v1/employees/:id
 * Update employee
 */
export const updateEmployee = asyncHandler(async (req, res) => {
  const updates = {
    employeeNumber: req.body.employeeNumber,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    branch: req.body.branch,
    department: req.body.department,
    position: req.body.position,
    joinDate: req.body.joinDate,
    birthDate: req.body.birthDate,
    pnfl: req.body.pnfl,
    phone: req.body.phone,
    email: req.body.email,
    telegramUsername: req.body.telegramUsername,
    address: req.body.address,
    salaryType: req.body.salaryType,
    salaryAmount: req.body.salaryAmount,
    status: req.body.status,
    kpiTemplate: req.body.kpiTemplate,
    experience: req.body.experience,
    contractStartDate: req.body.contractStartDate,
    contractEndDate: req.body.contractEndDate,
    // personId intentionally omitted — not editable, see employees.service.js
  };

  // Remove undefined values
  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });

  const employee = await employeesService.updateEmployee(req.params.id, updates);

  return successResponse(res, { employee }, MESSAGES.EMPLOYEE_UPDATED);
});

/**
 * POST /api/v1/employees/:id/photo
 * Upload/replace employee photo (avatar)
 */
export const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return errorResponse(res, 'Rasm fayli tanlanmagan', HTTP_STATUS.BAD_REQUEST);
  }

  const photoUrl = `/uploads/employees/${req.file.filename}`;

  let result;
  try {
    result = await employeesService.updateEmployeePhoto(req.params.id, photoUrl);
  } catch (error) {
    // Employee not found — remove the orphaned uploaded file
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }

  // Remove the previous photo file if it was replaced
  if (result.oldPhotoUrl) {
    const oldFileName = path.basename(result.oldPhotoUrl);
    await fs.unlink(path.join(employeePhotosDir, oldFileName)).catch(() => {});
  }

  return successResponse(res, { employee: result.employee }, 'Xodim rasmi saqlandi');
});

/**
 * POST /api/v1/employees/:id/resume
 * Upload/replace employee resume
 */
export const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    return errorResponse(res, 'Rezyume fayli tanlanmagan', HTTP_STATUS.BAD_REQUEST);
  }

  const resumeUrl = `/uploads/resumes/${req.file.filename}`;

  let result;
  try {
    result = await employeesService.updateEmployeeResume(req.params.id, resumeUrl, req.file.originalname);
  } catch (error) {
    // Employee not found — remove the orphaned uploaded file
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }

  // Remove the previous resume file if it was replaced
  if (result.oldResumeUrl) {
    const oldFileName = path.basename(result.oldResumeUrl);
    await fs.unlink(path.join(resumesDir, oldFileName)).catch(() => {});
  }

  return successResponse(res, { employee: result.employee }, 'Xodim rezyumesi saqlandi');
});

/**
 * DELETE /api/v1/employees/:id
 * Delete employee
 */
export const deleteEmployee = asyncHandler(async (req, res) => {
  const result = await employeesService.deleteEmployee(req.params.id);

  return successResponse(res, result, 'Employee deleted successfully');
});

