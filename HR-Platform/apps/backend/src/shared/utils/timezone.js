/**
 * Business timezone helpers — the app is deployed on a UTC server
 * (`process.env.TZ` unset in the Docker image), but every "is this
 * scan late", "which calendar day is this", "is this scan today"
 * decision must be judged against Uzbekistan wall-clock time
 * (Asia/Tashkent, UTC+5, no DST), not the server's own clock.
 *
 * Using `Date#getHours()`/`getMinutes()`/`setHours()` directly on a
 * timestamp silently reads/writes the *server's* local time — on this
 * server that's UTC, five hours behind Tashkent, which was quietly
 * shifting every lateness/early-leave/day-boundary comparison by 5
 * hours (e.g. a 09:31 Tashkent arrival was being compared as 04:31,
 * so "Kech keldi" almost never fired). Always go through these helpers
 * instead of the raw Date methods when the meaning is "what time/day
 * is it for the business", not "what time is it on this server".
 */

export const BUSINESS_TIMEZONE = 'Asia/Tashkent';

/**
 * { year, month (1-12), day, hour, minute } for `date`, as displayed on
 * a Tashkent wall clock — independent of the server's own timezone.
 */
function getBusinessParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = {};
  for (const part of parts) map[part.type] = part.value;

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24, // hourCycle h23 can still surface '24' at midnight in some ICU builds
    minute: Number(map.minute),
  };
}

/**
 * Minutes since midnight, Tashkent time — the "is 09:31 after the
 * 08:00 shift start" comparison unit used throughout schedules.service.js.
 */
export function businessMinutesSinceMidnight(date) {
  const { hour, minute } = getBusinessParts(date);
  return hour * 60 + minute;
}

/**
 * `date`'s calendar day *in Tashkent*, returned as a UTC-midnight Date
 * (matching how node-postgres already represents plain DATE columns
 * like work_schedules.start_date) so day-diffing stays simple:
 * `(businessDateOnly(a) - businessDateOnly(b)) / 86400000` is always a
 * whole number of days, with no server-timezone skew.
 *
 * This is a *day-identity* label, not a real instant — it's 5 hours off
 * from the true moment of Tashkent midnight (see businessDayStart below).
 * Fine for diffing two calendar days against each other; wrong for
 * bounding a real timestamp range query.
 */
export function businessDateOnly(date) {
  const { year, month, day } = getBusinessParts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The real UTC instant of 00:00:00 Tashkent time on `date`'s Tashkent
 * calendar day — use this (not businessDateOnly) when bounding an actual
 * `recorded_at >= ...` range query for "everything so far today". Tashkent
 * has no DST, so the fixed UTC+5 offset is safe to bake in directly;
 * Date.UTC normalizes the negative hour into the previous UTC day for us.
 */
export function businessDayStart(date) {
  const { year, month, day } = getBusinessParts(date);
  return new Date(Date.UTC(year, month - 1, day, -5, 0, 0, 0));
}
