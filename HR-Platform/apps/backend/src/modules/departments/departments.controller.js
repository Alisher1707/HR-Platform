import * as departmentsService from './departments.service.js';
import { successResponse, errorResponse, safeErrorMessage } from '../../shared/utils/response.js';
import { HTTP_STATUS } from '../../config/constants.js';

export async function getDepartments(req, res) {
  try {
    const departments = await departmentsService.listDepartments();
    return successResponse(res, departments, "Bo'limlar olindi");
  } catch (error) {
    console.error('Get departments error:', error);
    return errorResponse(res, safeErrorMessage(error, "Bo'limlarni olishda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createDepartment(req, res) {
  try {
    const department = await departmentsService.createDepartment(req.body.name, req.user.id);
    return successResponse(res, department, "Bo'lim yaratildi", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create department error:', error);
    return errorResponse(res, safeErrorMessage(error, "Bo'lim yaratishda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function updateDepartment(req, res) {
  try {
    const department = await departmentsService.updateDepartment(req.params.id, req.body.name);
    return successResponse(res, department, "Bo'lim yangilandi");
  } catch (error) {
    console.error('Update department error:', error);
    return errorResponse(res, safeErrorMessage(error, "Bo'limni yangilashda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteDepartment(req, res) {
  try {
    const result = await departmentsService.deleteDepartment(req.params.id);
    return successResponse(res, result, "Bo'lim o'chirildi");
  } catch (error) {
    console.error('Delete department error:', error);
    return errorResponse(res, safeErrorMessage(error, "Bo'limni o'chirishda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
