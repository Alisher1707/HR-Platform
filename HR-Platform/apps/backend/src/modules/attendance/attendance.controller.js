import * as attendanceService from './attendance.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Attendance Controller
 */

/**
 * GET /api/v1/attendance?date=YYYY-MM-DD&employeeId=...
 */
export async function getAttendance(req, res) {
  try {
    const { date, employeeId } = req.query;
    const records = await attendanceService.listAttendance({ date, employeeId });

    return successResponse(res, records, 'Davomat yozuvlari olindi');
  } catch (error) {
    console.error('Get attendance error:', error);
    return errorResponse(
      res,
      error.message || 'Davomat yozuvlarini olishda xatolik',
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/v1/attendance
 */
export async function createAttendance(req, res) {
  try {
    const { employeeId, type, recordedAt, notes } = req.body;

    const record = await attendanceService.createManualAttendance({
      employeeId,
      type,
      recordedAt,
      notes,
      createdBy: req.user.id,
    });

    return successResponse(res, record, 'Davomat yozuvi qo\'shildi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create attendance error:', error);
    return errorResponse(
      res,
      error.message || 'Davomat yozuvini qo\'shishda xatolik',
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * DELETE /api/v1/attendance/:id
 */
export async function deleteAttendance(req, res) {
  try {
    const { id } = req.params;
    const result = await attendanceService.deleteAttendance(id);

    return successResponse(res, result, 'Davomat yozuvi o\'chirildi');
  } catch (error) {
    console.error('Delete attendance error:', error);
    return errorResponse(
      res,
      error.message || 'Davomat yozuvini o\'chirishda xatolik',
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
