import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Work Schedules Service
 * A schedule is a named work-time template (start/end/break, cycle, etc.)
 * that gets assigned to one or more employees via work_schedule_employees.
 * Attendance recording reads this assignment to decide whether a "keldi"
 * scan counts as late.
 */

function mapSchedule(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    startDate: row.start_date,
    cycleDays: row.cycle_days,
    countOvertime: row.count_overtime,
    deductBreak: row.deduct_break,
    extendedHours: row.extended_hours,
    limitType: row.limit_type,
    limitHours: row.limit_hours,
    shiftLimitHours: row.shift_limit_hours,
    day: {
      isWorkDay: row.is_work_day,
      startTime: row.start_time,
      endTime: row.end_time,
      breakStart: row.break_start,
      breakEnd: row.break_end,
    },
    employeeIds: row.employee_ids || [],
    employees: row.employees || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_WITH_EMPLOYEES = `
  SELECT
    ws.*,
    COALESCE(
      json_agg(
        json_build_object('id', e.id, 'firstName', e.first_name, 'lastName', e.last_name)
        ORDER BY e.first_name
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'
    ) AS employees,
    COALESCE(array_agg(e.id) FILTER (WHERE e.id IS NOT NULL), '{}') AS employee_ids
  FROM work_schedules ws
  LEFT JOIN work_schedule_employees wse ON wse.schedule_id = ws.id
  LEFT JOIN employees e ON e.id = wse.employee_id
`;

export async function listSchedules() {
  const result = await query(`${SELECT_WITH_EMPLOYEES} GROUP BY ws.id ORDER BY ws.created_at DESC`);
  return result.rows.map(mapSchedule);
}

export async function getScheduleById(id) {
  const result = await query(`${SELECT_WITH_EMPLOYEES} WHERE ws.id = $1 GROUP BY ws.id`, [id]);
  if (result.rows.length === 0) {
    const error = new Error('Jadval topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return mapSchedule(result.rows[0]);
}

async function assignEmployees(client, scheduleId, employeeIds) {
  await client.query('DELETE FROM work_schedule_employees WHERE schedule_id = $1', [scheduleId]);

  if (employeeIds.length === 0) return;

  const values = employeeIds.map((_, idx) => `($1, $${idx + 2})`).join(', ');
  await client.query(
    `INSERT INTO work_schedule_employees (schedule_id, employee_id) VALUES ${values}`,
    [scheduleId, ...employeeIds]
  );
}

export async function createSchedule(data, userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO work_schedules
         (name, type, start_date, cycle_days, count_overtime, deduct_break, extended_hours,
          limit_type, limit_hours, shift_limit_hours, is_work_day, start_time, end_time,
          break_start, break_end, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        data.name, data.type, data.startDate, data.cycleDays, data.countOvertime, data.deductBreak,
        data.extendedHours, data.limitType || null, data.limitHours ?? null, data.shiftLimitHours ?? null,
        data.day.isWorkDay, data.day.startTime || null, data.day.endTime || null,
        data.day.breakStart || null, data.day.breakEnd || null, userId,
      ]
    );

    const scheduleId = insertResult.rows[0].id;
    await assignEmployees(client, scheduleId, data.employeeIds);

    await client.query('COMMIT');
    return getScheduleById(scheduleId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateSchedule(id, data) {
  await getScheduleById(id); // 404 if missing

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE work_schedules SET
         name = $1, type = $2, start_date = $3, cycle_days = $4, count_overtime = $5,
         deduct_break = $6, extended_hours = $7, limit_type = $8, limit_hours = $9,
         shift_limit_hours = $10, is_work_day = $11, start_time = $12, end_time = $13,
         break_start = $14, break_end = $15, updated_at = NOW()
       WHERE id = $16`,
      [
        data.name, data.type, data.startDate, data.cycleDays, data.countOvertime, data.deductBreak,
        data.extendedHours, data.limitType || null, data.limitHours ?? null, data.shiftLimitHours ?? null,
        data.day.isWorkDay, data.day.startTime || null, data.day.endTime || null,
        data.day.breakStart || null, data.day.breakEnd || null, id,
      ]
    );

    await assignEmployees(client, id, data.employeeIds);

    await client.query('COMMIT');
    return getScheduleById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSchedule(id) {
  await getScheduleById(id); // 404 if missing
  await query('DELETE FROM work_schedules WHERE id = $1', [id]);
  return { success: true, id };
}

/**
 * Assigns a single employee to a schedule (or unassigns them, when
 * scheduleId is null) — used by the Employee form's "Jadval" field, which
 * edits the relationship from the employee's side instead of the schedule's.
 * A schedule that ends up with zero employees is deleted rather than left
 * behind as an orphaned, unassignable record (schedules only exist to be
 * assigned to someone — see createSchedule's employeeIds.min(1) rule).
 */
export async function setEmployeeSchedule(employeeId, scheduleId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const removedFrom = await client.query(
      'DELETE FROM work_schedule_employees WHERE employee_id = $1 RETURNING schedule_id',
      [employeeId]
    );

    for (const row of removedFrom.rows) {
      const stillAssigned = await client.query(
        'SELECT 1 FROM work_schedule_employees WHERE schedule_id = $1 LIMIT 1',
        [row.schedule_id]
      );
      if (stillAssigned.rows.length === 0) {
        await client.query('DELETE FROM work_schedules WHERE id = $1', [row.schedule_id]);
      }
    }

    if (scheduleId) {
      const scheduleCheck = await client.query('SELECT id FROM work_schedules WHERE id = $1', [scheduleId]);
      if (scheduleCheck.rows.length === 0) {
        const error = new Error('Jadval topilmadi');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      await client.query(
        `INSERT INTO work_schedule_employees (schedule_id, employee_id)
         VALUES ($1, $2)
         ON CONFLICT (schedule_id, employee_id) DO NOTHING`,
        [scheduleId, employeeId]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return scheduleId ? getScheduleById(scheduleId) : null;
}

/**
 * The schedule currently governing an employee's attendance — if an
 * employee somehow ends up assigned to more than one, the most recently
 * created assignment wins.
 */
export async function getActiveScheduleForEmployee(employeeId) {
  const result = await query(
    `SELECT ws.* FROM work_schedules ws
     JOIN work_schedule_employees wse ON wse.schedule_id = ws.id
     WHERE wse.employee_id = $1
     ORDER BY wse.created_at DESC
     LIMIT 1`,
    [employeeId]
  );
  return result.rows[0] || null;
}

// Used when an employee has no schedule assigned yet (or their schedule
// doesn't specify a time) so Davomat/Analitika stay meaningful before HR
// gets around to setting up "Ish jadvallari" for everyone. A real assigned
// schedule's own time always wins over this once one exists.
const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '18:00';

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function timeStringToMinutes(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
}

/**
 * Compares a "keldi" scan's time-of-day against the employee's assigned
 * schedule's start_time, falling back to DEFAULT_START_TIME when no
 * schedule is assigned. Returns { isLate: boolean, scheduleId }|{ isLate: null, scheduleId }.
 * isLate is only null when an assigned schedule explicitly marks the day
 * as a non-work day — there's genuinely nothing to compare against.
 */
export async function computeLateness(employeeId, recordedAt) {
  const schedule = await getActiveScheduleForEmployee(employeeId);

  if (schedule && !schedule.is_work_day) {
    return { isLate: null, scheduleId: schedule.id };
  }

  const scanMinutes = minutesSinceMidnight(new Date(recordedAt));
  const scheduleMinutes = timeStringToMinutes(schedule?.start_time || DEFAULT_START_TIME);

  return { isLate: scanMinutes > scheduleMinutes, scheduleId: schedule ? schedule.id : null };
}

/**
 * Mirror of computeLateness for the "ketdi" (left) side of the day —
 * compares the scan time against the schedule's end_time, falling back to
 * DEFAULT_END_TIME when no schedule is assigned. Returns
 * { isEarly: boolean, scheduleId }|{ isEarly: null, scheduleId }.
 */
export async function computeEarlyLeave(employeeId, recordedAt) {
  const schedule = await getActiveScheduleForEmployee(employeeId);

  if (schedule && !schedule.is_work_day) {
    return { isEarly: null, scheduleId: schedule.id };
  }

  const scanMinutes = minutesSinceMidnight(new Date(recordedAt));
  const scheduleMinutes = timeStringToMinutes(schedule?.end_time || DEFAULT_END_TIME);

  return { isEarly: scanMinutes < scheduleMinutes, scheduleId: schedule ? schedule.id : null };
}
