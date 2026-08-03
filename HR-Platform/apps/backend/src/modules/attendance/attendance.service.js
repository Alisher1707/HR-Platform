import { query } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';
import { computeLateness, computeEarlyLeave } from '../schedules/schedules.service.js';

/**
 * Attendance Service
 * Reads/writes attendance_records — populated either by the face-recognition
 * device webhook (source='device') or by a human via the manual-entry form
 * (source='manual').
 */

/**
 * List attendance records, optionally scoped to a single day, a date range,
 * and/or a single employee. `date` (single day) and `startDate`/`endDate`
 * (range, used by Monitoring's Analitika trend) are mutually exclusive —
 * `date` wins if both are somehow present.
 */
export async function listAttendance({ date, startDate, endDate, employeeId } = {}) {
  const conditions = [];
  const params = [];

  if (date) {
    params.push(date);
    conditions.push(`ar.recorded_at::date = $${params.length}`);
  } else if (startDate && endDate) {
    params.push(startDate, endDate);
    conditions.push(`ar.recorded_at::date BETWEEN $${params.length - 1} AND $${params.length}`);
  }

  if (employeeId) {
    params.push(employeeId);
    conditions.push(`ar.employee_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       ar.id, ar.employee_id, ar.type, ar.recorded_at, ar.source, ar.notes,
       ar.device_token, ar.created_at, ar.is_late, ar.is_after_hours, ar.is_early_leave, ar.schedule_id,
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
 * Per-employee attendance summary over a date range — powers Monitoring >
 * Hisobotlar's "Davomat hisoboti" and "Davr bo'yicha hisobot" forms.
 * Only employees with at least one attendance record in range appear.
 */
export async function getAttendanceReport({ startDate, endDate, branches, departments, positions, employeeId } = {}) {
  const params = [startDate, endDate];
  const conditions = [];

  if (branches && branches.length) {
    params.push(branches);
    conditions.push(`e.branch = ANY($${params.length})`);
  }
  if (departments && departments.length) {
    params.push(departments);
    conditions.push(`e.department = ANY($${params.length})`);
  }
  if (positions && positions.length) {
    params.push(positions);
    conditions.push(`e.position = ANY($${params.length})`);
  }
  if (employeeId) {
    params.push(employeeId);
    conditions.push(`e.id = $${params.length}`);
  }

  const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  const result = await query(
    `WITH employee_schedule AS (
       SELECT DISTINCT ON (wse.employee_id)
         wse.employee_id, ws.start_time, ws.end_time
       FROM work_schedule_employees wse
       JOIN work_schedules ws ON ws.id = wse.schedule_id
       ORDER BY wse.employee_id, wse.created_at DESC
     ),
     daily AS (
       SELECT
         ar.employee_id,
         ar.recorded_at::date AS day,
         MIN(CASE WHEN ar.type = 'keldi' THEN ar.recorded_at END) AS first_keldi,
         MAX(CASE WHEN ar.type = 'ketdi' THEN ar.recorded_at END) AS last_ketdi,
         BOOL_OR(ar.type = 'keldi' AND ar.is_late) AS was_late,
         BOOL_OR(ar.type = 'ketdi' AND ar.is_early_leave) AS left_early
       FROM attendance_records ar
       WHERE ar.recorded_at::date BETWEEN $1 AND $2
       GROUP BY ar.employee_id, ar.recorded_at::date
     )
     SELECT
       e.id AS employee_id, e.first_name, e.last_name, e.branch, e.department, e.position,
       COUNT(d.day) FILTER (WHERE d.first_keldi IS NOT NULL) AS days_present,
       COUNT(d.day) FILTER (WHERE d.was_late) AS days_late,
       COUNT(d.day) FILTER (WHERE d.left_early) AS days_early_leave,
       COALESCE(SUM(
         EXTRACT(EPOCH FROM (d.last_ketdi - d.first_keldi)) / 3600.0
       ) FILTER (WHERE d.first_keldi IS NOT NULL AND d.last_ketdi IS NOT NULL AND d.last_ketdi > d.first_keldi), 0) AS total_hours,
       COALESCE(SUM(
         GREATEST(0,
           EXTRACT(EPOCH FROM (d.last_ketdi - d.first_keldi)) / 3600.0
           - EXTRACT(EPOCH FROM (es.end_time - es.start_time)) / 3600.0
         )
       ) FILTER (
         WHERE d.first_keldi IS NOT NULL AND d.last_ketdi IS NOT NULL AND d.last_ketdi > d.first_keldi
           AND es.start_time IS NOT NULL AND es.end_time IS NOT NULL
       ), 0) AS overtime_hours
     FROM employees e
     JOIN daily d ON d.employee_id = e.id
     LEFT JOIN employee_schedule es ON es.employee_id = e.id
     WHERE 1=1 ${where}
     GROUP BY e.id, e.first_name, e.last_name, e.branch, e.department, e.position
     ORDER BY e.first_name, e.last_name`,
    params
  );

  return result.rows.map((row) => ({
    employeeId: row.employee_id,
    firstName: row.first_name,
    lastName: row.last_name,
    branch: row.branch,
    department: row.department,
    position: row.position,
    daysPresent: Number(row.days_present),
    daysLate: Number(row.days_late),
    daysEarlyLeave: Number(row.days_early_leave),
    totalHours: Math.round(Number(row.total_hours) * 10) / 10,
    overtimeHours: Math.round(Number(row.overtime_hours) * 10) / 10,
  }));
}

/**
 * Recomputes an employee's "ichkarida/tashqarida" snapshot from their truly
 * most recent attendance record (by recorded_at — a manual entry can be
 * backdated, so trusting "whatever type was just inserted/deleted" would be
 * wrong). Called after every insert/delete (device or manual) so it never
 * goes stale; null when the employee has no attendance records at all.
 */
export async function recomputeEmployeePresence(employeeId) {
  const { rows } = await query(
    `SELECT type FROM attendance_records WHERE employee_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
    [employeeId]
  );
  const presence = rows.length > 0 ? (rows[0].type === 'keldi' ? 'ichkarida' : 'tashqarida') : null;
  await query('UPDATE employees SET current_presence = $1 WHERE id = $2', [presence, employeeId]);
  return presence;
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

  const { isLate, isAfterHours, isEarly, scheduleId } = type === 'keldi'
    ? { ...(await computeLateness(employeeId, recordedAt)), isEarly: null }
    : { isLate: null, isAfterHours: null, ...(await computeEarlyLeave(employeeId, recordedAt)) };

  const result = await query(
    `INSERT INTO attendance_records
       (employee_id, type, recorded_at, source, notes, created_by, is_late, is_after_hours, is_early_leave, schedule_id)
     VALUES ($1, $2, $3, 'manual', $4, $5, $6, $7, $8, $9)
     RETURNING id, employee_id, type, recorded_at, source, notes, created_at, is_late, is_after_hours, is_early_leave`,
    [employeeId, type, recordedAt, notes || null, createdBy, isLate, isAfterHours, isEarly, scheduleId]
  );

  await recomputeEmployeePresence(employeeId);

  return result.rows[0];
}

/**
 * Delete a manual attendance record. Device-sourced records are protected —
 * they reflect what the camera actually saw and shouldn't be editable here.
 */
export async function deleteAttendance(id) {
  const existing = await query('SELECT source, employee_id FROM attendance_records WHERE id = $1', [id]);

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
  await recomputeEmployeePresence(existing.rows[0].employee_id);

  return { success: true, id };
}
