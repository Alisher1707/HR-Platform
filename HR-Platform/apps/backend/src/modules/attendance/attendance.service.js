import { query } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Attendance Service
 * Reads/writes attendance_records — populated either by the face-recognition
 * device webhook (source='device') or by a human via the manual-entry form
 * (source='manual').
 */

/**
 * List attendance records, optionally scoped to a single day and/or employee.
 */
export async function listAttendance({ date, employeeId } = {}) {
  const conditions = [];
  const params = [];

  if (date) {
    params.push(date);
    conditions.push(`ar.recorded_at::date = $${params.length}`);
  }

  if (employeeId) {
    params.push(employeeId);
    conditions.push(`ar.employee_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       ar.id, ar.employee_id, ar.type, ar.recorded_at, ar.source, ar.notes,
       ar.device_token, ar.created_at,
       e.first_name, e.last_name, e.position, e.branch, e.photo_url
     FROM attendance_records ar
     JOIN employees e ON e.id = ar.employee_id
     ${where}
     ORDER BY ar.recorded_at ASC`,
    params
  );

  return result.rows;
}

/**
 * Create a manual attendance record (source='manual').
 */
export async function createManualAttendance({ employeeId, type, recordedAt, notes, createdBy }) {
  const employeeCheck = await query('SELECT id FROM employees WHERE id = $1', [employeeId]);
  if (employeeCheck.rows.length === 0) {
    const error = new Error('Xodim topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const result = await query(
    `INSERT INTO attendance_records (employee_id, type, recorded_at, source, notes, created_by)
     VALUES ($1, $2, $3, 'manual', $4, $5)
     RETURNING id, employee_id, type, recorded_at, source, notes, created_at`,
    [employeeId, type, recordedAt, notes || null, createdBy]
  );

  return result.rows[0];
}

/**
 * Delete a manual attendance record. Device-sourced records are protected —
 * they reflect what the camera actually saw and shouldn't be editable here.
 */
export async function deleteAttendance(id) {
  const existing = await query('SELECT source FROM attendance_records WHERE id = $1', [id]);

  if (existing.rows.length === 0) {
    const error = new Error('Davomat yozuvi topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  if (existing.rows[0].source !== 'manual') {
    const error = new Error("Faqat qo'lda kiritilgan yozuvlarni o'chirish mumkin");
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  await query('DELETE FROM attendance_records WHERE id = $1', [id]);

  return { success: true, id };
}
