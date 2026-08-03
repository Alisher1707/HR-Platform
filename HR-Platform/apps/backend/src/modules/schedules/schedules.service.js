import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Work Schedules Service
 * A schedule is a named work-time template that gets assigned to one or
 * more employees via work_schedule_employees. It repeats over `cycleDays`
 * days starting from `startDate`, with each day of that cycle configured
 * independently (work_schedule_days) — e.g. a "2 kun ishlaydi, 2 kun dam
 * oladi" rotating shift. Attendance recording reads the assignment + the
 * cycle day that applies "today" to decide whether a scan counts as late.
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

/** Attaches each schedule's per-cycle-day config (days[]) in one extra query, not N+1. */
async function attachDays(schedules) {
  if (schedules.length === 0) return schedules;

  const result = await query(
    `SELECT schedule_id, day_number, is_work_day, start_time, end_time, break_start, break_end
     FROM work_schedule_days
     WHERE schedule_id = ANY($1)
     ORDER BY schedule_id, day_number`,
    [schedules.map((s) => s.id)]
  );

  const daysBySchedule = {};
  for (const row of result.rows) {
    (daysBySchedule[row.schedule_id] ||= []).push({
      dayNumber: row.day_number,
      isWorkDay: row.is_work_day,
      startTime: row.start_time,
      endTime: row.end_time,
      breakStart: row.break_start,
      breakEnd: row.break_end,
    });
  }

  return schedules.map((s) => ({ ...s, days: daysBySchedule[s.id] || [] }));
}

export async function listSchedules() {
  const result = await query(`${SELECT_WITH_EMPLOYEES} GROUP BY ws.id ORDER BY ws.created_at DESC`);
  return attachDays(result.rows.map(mapSchedule));
}

export async function getScheduleById(id) {
  const result = await query(`${SELECT_WITH_EMPLOYEES} WHERE ws.id = $1 GROUP BY ws.id`, [id]);
  if (result.rows.length === 0) {
    const error = new Error('Jadval topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  const [schedule] = await attachDays([mapSchedule(result.rows[0])]);
  return schedule;
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

async function assignDays(client, scheduleId, days) {
  await client.query('DELETE FROM work_schedule_days WHERE schedule_id = $1', [scheduleId]);

  if (!days || days.length === 0) return;

  const params = [scheduleId];
  const valueRows = days.map((d) => {
    const start = params.length + 1;
    params.push(d.dayNumber, d.isWorkDay, d.startTime || null, d.endTime || null, d.breakStart || null, d.breakEnd || null);
    const placeholders = [0, 1, 2, 3, 4, 5].map((offset) => `$${start + offset}`);
    return `($1, ${placeholders.join(', ')})`;
  });

  await client.query(
    `INSERT INTO work_schedule_days (schedule_id, day_number, is_work_day, start_time, end_time, break_start, break_end)
     VALUES ${valueRows.join(', ')}`,
    params
  );
}

export async function createSchedule(data, userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO work_schedules
         (name, type, start_date, cycle_days, count_overtime, deduct_break, extended_hours,
          limit_type, limit_hours, shift_limit_hours, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        data.name, data.type, data.startDate, data.cycleDays, data.countOvertime, data.deductBreak,
        data.extendedHours, data.limitType || null, data.limitHours ?? null, data.shiftLimitHours ?? null, userId,
      ]
    );

    const scheduleId = insertResult.rows[0].id;
    await assignEmployees(client, scheduleId, data.employeeIds);
    await assignDays(client, scheduleId, data.days);

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
         shift_limit_hours = $10, updated_at = NOW()
       WHERE id = $11`,
      [
        data.name, data.type, data.startDate, data.cycleDays, data.countOvertime, data.deductBreak,
        data.extendedHours, data.limitType || null, data.limitHours ?? null, data.shiftLimitHours ?? null, id,
      ]
    );

    await assignEmployees(client, id, data.employeeIds);
    await assignDays(client, id, data.days);

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

/**
 * Which day-in-cycle (1-based, matching "Kun N") a given date falls on for
 * a schedule — counts whole days elapsed since start_date, wraps around
 * every cycle_days. Dates before start_date wrap "backwards" (still a
 * well-defined day-in-cycle) rather than going negative.
 */
function getDayNumberForDate(schedule, date) {
  const start = new Date(schedule.start_date);
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const cycle = schedule.cycle_days || 1;
  const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
  const offset = ((diffDays % cycle) + cycle) % cycle;
  return offset + 1;
}

async function getScheduleDay(scheduleId, dayNumber) {
  const result = await query(
    `SELECT is_work_day, start_time, end_time
     FROM work_schedule_days
     WHERE schedule_id = $1 AND day_number = $2`,
    [scheduleId, dayNumber]
  );
  return result.rows[0] || null;
}

// Used when an employee has no schedule assigned yet, or their schedule's
// cycle day has no config, so Davomat/Analitika stay meaningful before HR
// gets around to setting up "Ish jadvallari" for everyone. A real assigned
// day's own time always wins over this once one exists.
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
 * Compares a "keldi" scan's time-of-day against the cycle day (Kun N) that
 * applies on the scan's date, falling back to DEFAULT_START_TIME when no
 * schedule/day config is assigned. Returns { isLate, isAfterHours, scheduleId }.
 * isLate is only null when that cycle day is explicitly marked a non-work
 * day — there's genuinely nothing to compare against. isAfterHours is a
 * separate flag (only meaningful when isLate is true): it's set when the
 * scan happened after that day's own END time too, i.e. the whole work
 * day was already over — Davomat shows plain "Keldi" instead of "Kech
 * keldi" for those, since "late" stops being the right word once the
 * shift itself has ended. is_late itself keeps its old meaning for
 * reports/statistika.
 */
export async function computeLateness(employeeId, recordedAt) {
  const schedule = await getActiveScheduleForEmployee(employeeId);
  const scanDate = new Date(recordedAt);
  const day = schedule ? await getScheduleDay(schedule.id, getDayNumberForDate(schedule, scanDate)) : null;

  if (day && !day.is_work_day) {
    return { isLate: null, isAfterHours: null, scheduleId: schedule.id };
  }

  const scanMinutes = minutesSinceMidnight(scanDate);
  const startMinutes = timeStringToMinutes(day?.start_time || DEFAULT_START_TIME);
  const endMinutes = timeStringToMinutes(day?.end_time || DEFAULT_END_TIME);

  return {
    isLate: scanMinutes > startMinutes,
    isAfterHours: scanMinutes > endMinutes,
    scheduleId: schedule ? schedule.id : null,
  };
}

/**
 * Mirror of computeLateness for the "ketdi" (left) side of the day —
 * compares the scan time against that cycle day's end_time. Returns
 * { isEarly, scheduleId }.
 */
export async function computeEarlyLeave(employeeId, recordedAt) {
  const schedule = await getActiveScheduleForEmployee(employeeId);
  const scanDate = new Date(recordedAt);
  const day = schedule ? await getScheduleDay(schedule.id, getDayNumberForDate(schedule, scanDate)) : null;

  if (day && !day.is_work_day) {
    return { isEarly: null, scheduleId: schedule.id };
  }

  const scanMinutes = minutesSinceMidnight(scanDate);
  const scheduleMinutes = timeStringToMinutes(day?.end_time || DEFAULT_END_TIME);

  return { isEarly: scanMinutes < scheduleMinutes, scheduleId: schedule ? schedule.id : null };
}
