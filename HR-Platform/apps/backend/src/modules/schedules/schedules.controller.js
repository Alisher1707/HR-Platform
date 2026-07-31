import * as schedulesService from './schedules.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
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
    return errorResponse(res, error.message || 'Jadvallarni olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getScheduleById(req, res) {
  try {
    const schedule = await schedulesService.getScheduleById(req.params.id);
    return successResponse(res, schedule, 'Jadval olindi');
  } catch (error) {
    console.error('Get schedule error:', error);
    return errorResponse(res, error.message || 'Jadvalni olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createSchedule(req, res) {
  try {
    const schedule = await schedulesService.createSchedule(req.body, req.user.id);
    return successResponse(res, schedule, "Yangi jadval qo'shildi", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create schedule error:', error);
    return errorResponse(res, error.message || 'Jadval yaratishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function updateSchedule(req, res) {
  try {
    const schedule = await schedulesService.updateSchedule(req.params.id, req.body);
    return successResponse(res, schedule, 'Jadval yangilandi');
  } catch (error) {
    console.error('Update schedule error:', error);
    return errorResponse(res, error.message || 'Jadvalni yangilashda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteSchedule(req, res) {
  try {
    const result = await schedulesService.deleteSchedule(req.params.id);
    return successResponse(res, result, "Jadval o'chirildi");
  } catch (error) {
    console.error('Delete schedule error:', error);
    return errorResponse(res, error.message || "Jadvalni o'chirishda xatolik", error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
