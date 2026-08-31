import * as schedulesService from './schedules.service.js';
import { successResponse, errorResponse, safeErrorMessage } from '../../shared/utils/response.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Work Schedules Controller
 */

export async function getSchedules(req, res) {
  try {
    const schedules = await schedulesService.listSchedules();
    return successResponse(res, schedules, 'Jadvallar olindi');
  } catch (error) {
    console.error('Get schedules error:', error);
    return errorResponse(res, safeErrorMessage(error, 'Jadvallarni olishda xatolik'), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getScheduleById(req, res) {
  try {
    const schedule = await schedulesService.getScheduleById(req.params.id);
    return successResponse(res, schedule, 'Jadval olindi');
  } catch (error) {
    console.error('Get schedule error:', error);
    return errorResponse(res, safeErrorMessage(error, 'Jadvalni olishda xatolik'), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createSchedule(req, res) {
  try {
    const schedule = await schedulesService.createSchedule(req.body, req.user.id);
    return successResponse(res, schedule, "Yangi jadval qo'shildi", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create schedule error:', error);
    return errorResponse(res, safeErrorMessage(error, 'Jadval yaratishda xatolik'), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function updateSchedule(req, res) {
  try {
    const schedule = await schedulesService.updateSchedule(req.params.id, req.body);
    return successResponse(res, schedule, 'Jadval yangilandi');
  } catch (error) {
    console.error('Update schedule error:', error);
    return errorResponse(res, safeErrorMessage(error, 'Jadvalni yangilashda xatolik'), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function setEmployeeSchedule(req, res) {
  try {
    const schedule = await schedulesService.setEmployeeSchedule(req.params.employeeId, req.body.scheduleId || null);
    return successResponse(res, schedule, 'Xodimning jadvali yangilandi');
  } catch (error) {
    console.error('Set employee schedule error:', error);
    return errorResponse(res, safeErrorMessage(error, "Xodimga jadval biriktirishda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteSchedule(req, res) {
  try {
    const result = await schedulesService.deleteSchedule(req.params.id);
    return successResponse(res, result, "Jadval o'chirildi");
  } catch (error) {
    console.error('Delete schedule error:', error);
    return errorResponse(res, safeErrorMessage(error, "Jadvalni o'chirishda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
