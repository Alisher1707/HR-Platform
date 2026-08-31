import { query } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';
import { computeLateness, computeEarlyLeave, computeShiftLimit, timeStringToMinutes, DEFAULT_START_TIME } from '../schedules/schedules.service.js';
import { checkLateArrivalFine, checkEarlyLeaveFine } from '../../services/autoFineService.js';
import { businessDayStart, businessDateOnly, businessMinutesSinceMidnight } from '../../shared/utils/timezone.js';

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
       ar.device_token, ar.created_at, ar.is_late, ar.is_after_hours, ar.is_early_leave,
       ar.is_over_shift_limit, ar.day_boundary, ar.schedule_id, ws.type AS schedule_type,
       e.first_name, e.last_name, e.position, e.branch, e.photo_url
     FROM attendance_records ar
     JOIN employees e ON e.id = ar.employee_id
     LEFT JOIN work_schedules ws ON ws.id = ar.schedule_id
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
export async function getAttendanceReport({ startDate, endDate, branches, departments, positions, scheduleIds, employeeId } = {}) {
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
  if (scheduleIds && scheduleIds.length) {
    params.push(scheduleIds);
    conditions.push(`EXISTS (
      SELECT 1 FROM work_schedule_employees wse2
      WHERE wse2.employee_id = e.id AND wse2.schedule_id = ANY($${params.length})
    )`);
  }
  if (employeeId) {
    params.push(employeeId);
    conditions.push(`e.id = $${params.length}`);
  }

  const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  const result = await query(
    `WITH employee_schedule AS (
       SELECT DISTINCT ON (wse.employee_id)
         wse.employee_id, wse.schedule_id, ws.type AS schedule_type, ws.start_date,
         GREATEST(ws.cycle_days, 1) AS cycle_days,
         ws.limit_type, ws.limit_hours, ws.shift_limit_hours
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
         BOOL_OR(ar.type = 'ketdi' AND ar.is_early_leave) AS left_early,
         BOOL_OR(ar.type = 'ketdi' AND ar.is_over_shift_limit) AS over_shift_limit
       FROM attendance_records ar
       WHERE ar.recorded_at::date BETWEEN $1 AND $2
       GROUP BY ar.employee_id, ar.recorded_at::date
     ),
     -- Har bir kun o'zining sikl ichidagi kuni (Kun 1, Kun 2, ...) bo'yicha
     -- work_schedule_days'dan mos ish vaqtini oladi — bitta doimiy
     -- start_time/end_time endi mavjud emas (030-migratsiya), sikl davomida
     -- kunlar turlicha bo'lishi mumkin. "Gibrid"/"Erkin" jadvallarda kun
     -- konfiguratsiyasi umuman yo'q (qat'iy vaqt tushunchasi qo'llanmaydi),
     -- shuning uchun ular uchun sched_start_time/end_time doim NULL bo'lib,
     -- overtime_hours hisobidan tabiiy ravishda chetlab o'tiladi.
     daily_with_schedule AS (
       SELECT
         d.*,
         wsd.start_time AS sched_start_time,
         wsd.end_time AS sched_end_time,
         es.schedule_type, es.limit_type, es.limit_hours, es.shift_limit_hours
       FROM daily d
       LEFT JOIN employee_schedule es ON es.employee_id = d.employee_id
       LEFT JOIN work_schedule_days wsd
         ON wsd.schedule_id = es.schedule_id
         AND wsd.day_number = (((d.day - es.start_date) % es.cycle_days + es.cycle_days) % es.cycle_days) + 1
     )
     SELECT
       e.id AS employee_id, e.first_name, e.last_name, e.branch, e.department, e.position,
       MAX(d.schedule_type) AS schedule_type,
       MAX(d.limit_type) AS limit_type,
       MAX(d.limit_hours) AS limit_hours,
       MAX(d.shift_limit_hours) AS shift_limit_hours,
       COUNT(d.day) FILTER (WHERE d.first_keldi IS NOT NULL) AS days_present,
       COUNT(d.day) FILTER (WHERE d.was_late) AS days_late,
       COUNT(d.day) FILTER (WHERE d.left_early) AS days_early_leave,
       COUNT(d.day) FILTER (WHERE d.over_shift_limit) AS days_over_shift_limit,
       COALESCE(SUM(
         EXTRACT(EPOCH FROM (d.last_ketdi - d.first_keldi)) / 3600.0
       ) FILTER (WHERE d.first_keldi IS NOT NULL AND d.last_ketdi IS NOT NULL AND d.last_ketdi > d.first_keldi), 0) AS total_hours,
       COALESCE(SUM(
         GREATEST(0,
           EXTRACT(EPOCH FROM (d.last_ketdi - d.first_keldi)) / 3600.0
           - EXTRACT(EPOCH FROM (d.sched_end_time - d.sched_start_time)) / 3600.0
         )
       ) FILTER (
         WHERE d.first_keldi IS NOT NULL AND d.last_ketdi IS NOT NULL AND d.last_ketdi > d.first_keldi
           AND d.sched_start_time IS NOT NULL AND d.sched_end_time IS NOT NULL
       ), 0) AS overtime_hours
     FROM employees e
     JOIN daily_with_schedule d ON d.employee_id = e.id
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
    scheduleType: row.schedule_type,
    limitType: row.limit_type,
    limitHours: row.limit_hours === null ? null : Number(row.limit_hours),
    shiftLimitHours: row.shift_limit_hours === null ? null : Number(row.shift_limit_hours),
    daysPresent: Number(row.days_present),
    daysLate: Number(row.days_late),
    daysEarlyLeave: Number(row.days_early_leave),
    daysOverShiftLimit: Number(row.days_over_shift_limit),
    totalHours: Math.round(Number(row.total_hours) * 10) / 10,
    overtimeHours: Math.round(Number(row.overtime_hours) * 10) / 10,
  }));
}

/**
 * Bugungi kunning bo'lim kesimidagi jonli holati — Davomat sahifasi
 * tepasidagi diagramma uchun. Har bir xodim to'rtta holatdan biriga
 * tushadi:
 *  - "onTime" — bugun keldi, kech qolmadi (yoki jadval turi "gibrid"/
 *    "erkin" bo'lgani uchun kech qolish tushunchasi umuman qo'llanmaydi)
 *  - "late" — bugun keldi, lekin moslashuvchan jadval bo'yicha kech qoldi
 *  - "absent" — jadvalining boshlanish vaqti allaqachon o'tgan, lekin
 *    hali kelmagan
 *  - "pending" — jadvalining boshlanish vaqti hali kelmagan (na kelgan,
 *    na "kelmagan" deb belgilash uchun vaqt o'tgan) — foizga kiritilmaydi,
 *    ertalab butun bo'lim soxta "qizil" bo'lib ko'rinishining oldini oladi
 * Dam olish kuni bo'lgan xodimlar butunlay hisobdan tashqarida qoladi —
 * ular uchun "kelmagan" tushunchasi ma'nosiz.
 */
export async function getDepartmentAttendanceSummary() {
  const now = new Date();
  const todayStart = businessDayStart(now);
  const todayDate = businessDateOnly(now);
  const nowMinutes = businessMinutesSinceMidnight(now);

  const { rows } = await query(
    `WITH employee_schedule AS (
       SELECT DISTINCT ON (wse.employee_id)
         wse.employee_id, wse.schedule_id, ws.type AS schedule_type,
         ws.start_date, GREATEST(ws.cycle_days, 1) AS cycle_days
       FROM work_schedule_employees wse
       JOIN work_schedules ws ON ws.id = wse.schedule_id
       ORDER BY wse.employee_id, wse.created_at DESC
     ),
     schedule_today AS (
       SELECT
         es.employee_id, es.schedule_type,
         wsd.is_work_day, wsd.start_time
       FROM employee_schedule es
       LEFT JOIN work_schedule_days wsd
         ON wsd.schedule_id = es.schedule_id
         AND wsd.day_number = ((($2::date - es.start_date) % es.cycle_days + es.cycle_days) % es.cycle_days) + 1
     ),
     first_scan AS (
       SELECT DISTINCT ON (employee_id) employee_id, is_late
       FROM attendance_records
       WHERE type = 'keldi' AND recorded_at >= $1 AND recorded_at < NOW()
       ORDER BY employee_id, recorded_at ASC
     )
     SELECT
       e.department,
       st.schedule_type,
       st.is_work_day,
       st.start_time,
       (fs.employee_id IS NOT NULL) AS has_scan,
       fs.is_late
     FROM employees e
     LEFT JOIN schedule_today st ON st.employee_id = e.id
     LEFT JOIN first_scan fs ON fs.employee_id = e.id
     WHERE e.department IS NOT NULL AND e.department <> ''`,
    [todayStart, todayDate]
  );

  const byDepartment = new Map();

  for (const row of rows) {
    if (row.is_work_day === false) continue; // dam olish kuni — hisobdan tashqari

    if (!byDepartment.has(row.department)) {
      byDepartment.set(row.department, { department: row.department, total: 0, onTime: 0, late: 0, absent: 0, pending: 0 });
    }
    const bucket = byDepartment.get(row.department);
    bucket.total++;

    if (row.has_scan) {
      const isLateApplicable = !row.schedule_type || row.schedule_type === 'moslashuvchan';
      if (isLateApplicable && row.is_late === true) {
        bucket.late++;
      } else {
        bucket.onTime++;
      }
    } else {
      const startMinutes = timeStringToMinutes(row.start_time || DEFAULT_START_TIME);
      if (nowMinutes > startMinutes) {
        bucket.absent++;
      } else {
        bucket.pending++;
      }
    }
  }

  return [...byDepartment.values()].sort((a, b) => a.department.localeCompare(b.department));
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
  // `deleted_at IS NULL` — arxivlangan xodimga yangi davomat yozib
  // bo'lmaydi (migratsiya 060). Mavjud tarixiy yozuvlari o'z joyida
  // qoladi va hisobotlarda ko'rinaveradi.
  const employeeCheck = await query('SELECT id FROM employees WHERE id = $1 AND deleted_at IS NULL', [employeeId]);
  if (employeeCheck.rows.length === 0) {
    const error = new Error('Xodim topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const { isLate, isAfterHours, isEarly, isOverShiftLimit, scheduleId } = type === 'keldi'
    ? { ...(await computeLateness(employeeId, recordedAt)), isEarly: null, isOverShiftLimit: null }
    : {
        isLate: null,
        isAfterHours: null,
        ...(await computeEarlyLeave(employeeId, recordedAt)),
        ...(await computeShiftLimit(employeeId, recordedAt)),
      };

  const result = await query(
    `INSERT INTO attendance_records
       (employee_id, type, recorded_at, source, notes, created_by, is_late, is_after_hours, is_early_leave, is_over_shift_limit, schedule_id)
     VALUES ($1, $2, $3, 'manual', $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, employee_id, type, recorded_at, source, notes, created_at, is_late, is_after_hours, is_early_leave, is_over_shift_limit`,
    [employeeId, type, recordedAt, notes || null, createdBy, isLate, isAfterHours, isEarly, isOverShiftLimit, scheduleId]
  );

  await recomputeEmployeePresence(employeeId);

  if (type === 'keldi') {
    await checkLateArrivalFine(employeeId, recordedAt, isLate);
  } else {
    await checkEarlyLeaveFine(employeeId, recordedAt, isEarly);
  }

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
