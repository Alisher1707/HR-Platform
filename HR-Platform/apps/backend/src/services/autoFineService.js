import { query, getClient } from '../config/database.js';
import { businessDayStart, businessDateOnly, businessMinutesSinceMidnight } from '../shared/utils/timezone.js';
import { notifyFineCreated } from '../modules/telegram/telegramBot.service.js';
import {
  getActiveScheduleForEmployee,
  getDayNumberForDate,
  getScheduleDay,
  timeStringToMinutes,
  DEFAULT_START_TIME,
  DEFAULT_END_TIME,
} from '../modules/schedules/schedules.service.js';

/**
 * Auto Fine Service
 * When an employee assigned to an enabled fine policy violates a rule the
 * policy defines, this writes a real employee_fines row for them — no HR
 * click needed. Two mechanisms:
 *  - checkLateArrivalFine/checkEarlyLeaveFine — called synchronously right
 *    after a "keldi"/"ketdi" attendance_records insert (device webhook or
 *    manual entry), since lateness/earliness is only knowable at that
 *    instant.
 *  - processDailyAutoFines (cron) — "kelmagan_kun"/"chiqish_yoq" can only
 *    be judged once a work day is fully over, so this walks yesterday's
 *    business day for every employee assigned to a matching policy.
 * All writes go through a partial-unique-index dedup (employee_id,
 * policy_template_id, violation_date) WHERE source='auto', so re-running
 * the cron or a retried webhook never double-charges.
 */

// "00:15" -> 15. A template's time_limit is the grace period a violation
// must exceed before it's fine-worthy, not the fine trigger itself.
function parseTimeLimitMinutes(timeLimit) {
  if (!timeLimit) return 0;
  const [hour, minute] = timeLimit.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

async function getMatchingTemplates(employeeId, violationType) {
  const result = await query(
    `SELECT fpt.id, fpt.time_limit, fpt.amount, fpt.fine_type_id
     FROM fine_policy_templates fpt
     JOIN fine_policies fp ON fp.id = fpt.policy_id AND fp.enabled = true
     JOIN fine_policy_employees fpe ON fpe.policy_id = fp.id AND fpe.employee_id = $1
     WHERE fpt.violation_type = $2`,
    [employeeId, violationType]
  );
  return result.rows;
}

// `run` is a callable (sql, params) => Promise<QueryResult> — either the
// pool's `query` directly, or `client.query.bind(client)` inside a
// transaction (see processDailyAutoFines).
async function insertAutoFine(run, { employeeId, amount, fineTypeId, policyTemplateId, violationDate, note }) {
  const result = await run(
    `INSERT INTO employee_fines (employee_id, amount, fine_type_id, note, source, policy_template_id, violation_date)
     VALUES ($1, $2, $3, $4, 'auto', $5, $6)
     ON CONFLICT (employee_id, policy_template_id, violation_date) WHERE source = 'auto' DO NOTHING
     RETURNING id`,
    [employeeId, amount, fineTypeId || null, note, policyTemplateId, violationDate]
  );
  const created = result.rows.length > 0;

  // Fire-and-forget — this can run inside processDailyAutoFines' DB
  // transaction, so it must never be awaited (would hold the transaction
  // open for a network round-trip) and never throw (already self-catches).
  if (created) notifyFineCreated(employeeId, { amount, note });

  return created;
}

/**
 * Called right after a "keldi" scan is recorded. `isLate` is the boolean
 * already computed by computeLateness for that same scan — skip entirely
 * when it's not true, so the common (on-time) case never touches the DB
 * again. Only fires for "moslashuvchan" schedules, same constraint
 * computeLateness itself has (minutes-late has no meaning otherwise).
 */
export async function checkLateArrivalFine(employeeId, recordedAt, isLate) {
  if (!isLate) return;

  try {
    const templates = await getMatchingTemplates(employeeId, 'kech_kelish');
    if (templates.length === 0) return;

    const schedule = await getActiveScheduleForEmployee(employeeId);
    if (!schedule || schedule.type !== 'moslashuvchan') return;

    const day = await getScheduleDay(schedule.id, getDayNumberForDate(schedule, recordedAt));
    if (day && !day.is_work_day) return;

    const scanMinutes = businessMinutesSinceMidnight(recordedAt);
    const startMinutes = timeStringToMinutes(day?.start_time || DEFAULT_START_TIME);
    const minutesLate = scanMinutes - startMinutes;
    if (minutesLate <= 0) return;

    const violationDate = businessDateOnly(recordedAt);
    for (const template of templates) {
      if (minutesLate > parseTimeLimitMinutes(template.time_limit)) {
        await insertAutoFine(query, {
          employeeId,
          amount: template.amount,
          fineTypeId: template.fine_type_id,
          policyTemplateId: template.id,
          violationDate,
          note: `Kech kelish — ${minutesLate} daqiqa (avtomatik)`,
        });
      }
    }
  } catch (error) {
    console.error(`Auto-fine (kech kelish) check failed for employee ${employeeId}:`, error);
  }
}

/** Mirror of checkLateArrivalFine for the "ketdi" (early leave) side. */
export async function checkEarlyLeaveFine(employeeId, recordedAt, isEarly) {
  if (!isEarly) return;

  try {
    const templates = await getMatchingTemplates(employeeId, 'erta_ketish');
    if (templates.length === 0) return;

    const schedule = await getActiveScheduleForEmployee(employeeId);
    if (!schedule || schedule.type !== 'moslashuvchan') return;

    const day = await getScheduleDay(schedule.id, getDayNumberForDate(schedule, recordedAt));
    if (day && !day.is_work_day) return;

    const scanMinutes = businessMinutesSinceMidnight(recordedAt);
    const endMinutes = timeStringToMinutes(day?.end_time || DEFAULT_END_TIME);
    const minutesEarly = endMinutes - scanMinutes;
    if (minutesEarly <= 0) return;

    const violationDate = businessDateOnly(recordedAt);
    for (const template of templates) {
      if (minutesEarly > parseTimeLimitMinutes(template.time_limit)) {
        await insertAutoFine(query, {
          employeeId,
          amount: template.amount,
          fineTypeId: template.fine_type_id,
          policyTemplateId: template.id,
          violationDate,
          note: `Erta ketish — ${minutesEarly} daqiqa (avtomatik)`,
        });
      }
    }
  } catch (error) {
    console.error(`Auto-fine (erta ketish) check failed for employee ${employeeId}:`, error);
  }
}

/**
 * Daily sweep for "kelmagan_kun" (no scan at all) and "chiqish_yoq" (keldi
 * with no matching ketdi) — both only decidable once the day is over, so
 * this always looks at YESTERDAY's business day, never today's (an
 * employee could still check in/out before midnight).
 */
export async function processDailyAutoFines() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dayStart = businessDayStart(yesterday);
    const dayEnd = businessDayStart(new Date());
    const violationDate = businessDateOnly(yesterday);

    const { rows: candidates } = await client.query(
      `SELECT DISTINCT fpe.employee_id, fpt.id AS template_id, fpt.violation_type,
              fpt.amount, fpt.fine_type_id
       FROM fine_policy_employees fpe
       JOIN fine_policies fp ON fp.id = fpe.policy_id AND fp.enabled = true
       JOIN fine_policy_templates fpt ON fpt.policy_id = fp.id
       WHERE fpt.violation_type IN ('kelmagan_kun', 'chiqish_yoq')`
    );

    let processed = 0;
    for (const candidate of candidates) {
      try {
        const schedule = await getActiveScheduleForEmployee(candidate.employee_id);
        if (!schedule) continue;

        const day = await getScheduleDay(schedule.id, getDayNumberForDate(schedule, yesterday));
        if (!day || !day.is_work_day) continue;

        const { rows: records } = await client.query(
          `SELECT type FROM attendance_records WHERE employee_id = $1 AND recorded_at >= $2 AND recorded_at < $3`,
          [candidate.employee_id, dayStart, dayEnd]
        );
        const hasKeldi = records.some((r) => r.type === 'keldi');
        const hasKetdi = records.some((r) => r.type === 'ketdi');

        let note = null;
        if (candidate.violation_type === 'kelmagan_kun' && !hasKeldi) {
          note = 'Kelmagan kun (avtomatik)';
        } else if (candidate.violation_type === 'chiqish_yoq' && hasKeldi && !hasKetdi) {
          note = "Chiqish qayd etilmagan (avtomatik)";
        }
        if (!note) continue;

        const created = await insertAutoFine(client.query.bind(client), {
          employeeId: candidate.employee_id,
          amount: candidate.amount,
          fineTypeId: candidate.fine_type_id,
          policyTemplateId: candidate.template_id,
          violationDate,
          note,
        });
        if (created) processed++;
      } catch (err) {
        console.error(`Auto-fine daily check failed for employee ${candidate.employee_id}:`, err.message);
      }
    }

    await client.query('COMMIT');
    return { processed, checked: candidates.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Runs every 30 minutes rather than once a day — there's no real cron
 * scheduler in this codebase (see startAutoPromotionCron), and re-running
 * the same yesterday-check repeatedly is harmless: the partial unique
 * index makes every run idempotent.
 */
export function startAutoFineCron() {
  const INTERVAL = 30 * 60 * 1000;

  console.log('🚀 Starting auto-fine cron job (runs every 30 minutes)');

  processDailyAutoFines()
    .then((result) => {
      if (result.processed > 0) console.log(`✅ Initial scan: ${result.processed} avtomatik jarima yozildi`);
    })
    .catch((err) => console.error('❌ Initial auto-fine scan failed:', err));

  setInterval(async () => {
    try {
      const result = await processDailyAutoFines();
      if (result.processed > 0) console.log(`✅ Cron: ${result.processed} avtomatik jarima yozildi`);
    } catch (error) {
      console.error('❌ Cron auto-fine scan failed:', error);
    }
  }, INTERVAL);
}
