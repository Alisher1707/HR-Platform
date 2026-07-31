import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../../config/database.js';
import { computeLateness, computeEarlyLeave } from '../schedules/schedules.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventsDir = path.join(__dirname, '../../../uploads/device-events');
if (!fs.existsSync(eventsDir)) {
  fs.mkdirSync(eventsDir, { recursive: true });
}

const DUPLICATE_WINDOW_SECONDS = 60;

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'i'));
  return match ? match[1].trim() : null;
}

/**
 * Hikvision access-event payloads are JSON, and often JSON-encoded as a
 * *string* nested inside another JSON object's field (e.g. the multipart
 * "AccessControllerEvent" text field is itself a JSON string containing a
 * further "AccessControllerEvent" object with employeeNoString inside it).
 * This walks strings/objects/arrays recursively, JSON.parse-ing strings as
 * it goes, until it finds an employeeNoString/employeeNo key.
 */
function findPersonIdInJson(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    try {
      return findPersonIdInJson(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPersonIdInJson(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    if (value.employeeNoString) return String(value.employeeNoString);
    if (value.employeeNo) return String(value.employeeNo);

    for (const nested of Object.values(value)) {
      const found = findPersonIdInJson(nested);
      if (found) return found;
    }
  }

  return null;
}

/** Gathers every text blob (multipart fields, raw body, text/xml/json file parts) worth scanning. */
function getCandidateTexts(req) {
  const candidates = [];

  if (req.body) {
    candidates.push(...Object.values(req.body).filter((v) => typeof v === 'string'));
  }
  if (req.rawBody) {
    candidates.push(req.rawBody);
  }
  if (req.files) {
    for (const file of req.files) {
      if (file.mimetype.startsWith('text/') || file.mimetype.includes('xml') || file.mimetype.includes('json')) {
        candidates.push(file.buffer.toString('utf8'));
      }
    }
  }

  return candidates;
}

/**
 * Pulls the camera's reported person/employee ID out of the gathered text —
 * Hikvision sends this as either XML (<employeeNoString>) or JSON
 * (possibly JSON-encoded as a string nested inside another field).
 */
function extractPersonId(candidates) {
  for (const text of candidates) {
    const personId = extractTag(text, 'employeeNoString') || extractTag(text, 'employeeNo') || findPersonIdInJson(text);
    if (personId) return personId;
  }
  return null;
}

/** Hikvision heartbeats carry eventType: "heartBeat" somewhere in the payload. */
function isHeartbeat(candidates) {
  return candidates.some((text) => /heartbeat/i.test(text));
}

async function findEmployeeByPersonId(personId) {
  const result = await query(
    'SELECT id, first_name, last_name FROM employees WHERE person_id = $1 LIMIT 1',
    [personId]
  );
  return result.rows[0] || null;
}

/**
 * Lightweight log of every incoming device request — heartbeat, unmatched,
 * or a real access event — so Monitoring > Terminallar can show which
 * cameras are actually alive without needing any manual "add device" step.
 * Fire-and-forget: a logging failure must never break the device's response.
 */
async function logDeviceEvent(deviceToken, eventType, personId, employeeId) {
  try {
    await query(
      `INSERT INTO device_events (device_token, event_type, person_id, employee_id)
       VALUES ($1, $2, $3, $4)`,
      [deviceToken, eventType, personId || null, employeeId || null]
    );
  } catch (err) {
    console.error("device_events yozishda xatolik (e'tiborsiz qoldirildi):", err.message);
  }
}

/**
 * First scan of the day = keldi, next = ketdi, anything after that keeps
 * refreshing ketdi (treated as "left again"). Scans within 60s of the
 * previous one for the same employee are ignored as duplicates — Hikvision
 * terminals fire repeatedly while a face stays in frame.
 */
async function recordAttendance(employeeId, deviceToken, rawPersonId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { rows } = await query(
    `SELECT type, recorded_at FROM attendance_records
     WHERE employee_id = $1 AND recorded_at >= $2
     ORDER BY recorded_at DESC`,
    [employeeId, todayStart]
  );

  if (rows.length > 0) {
    const secondsSinceLast = (Date.now() - new Date(rows[0].recorded_at).getTime()) / 1000;
    if (secondsSinceLast < DUPLICATE_WINDOW_SECONDS) {
      return { skipped: true, reason: `oxirgi hodisadan ${Math.round(secondsSinceLast)}s o'tgan, takror deb hisoblandi` };
    }
  }

  const hasKeldi = rows.some((r) => r.type === 'keldi');
  const type = !hasKeldi ? 'keldi' : 'ketdi';

  const recordedAt = new Date();
  const { isLate, isEarly, scheduleId } = type === 'keldi'
    ? { ...(await computeLateness(employeeId, recordedAt)), isEarly: null }
    : { isLate: null, ...(await computeEarlyLeave(employeeId, recordedAt)) };

  await query(
    `INSERT INTO attendance_records
       (employee_id, type, device_token, raw_person_id, recorded_at, is_late, is_early_leave, schedule_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [employeeId, type, deviceToken, rawPersonId, recordedAt, isLate, isEarly, scheduleId]
  );

  return { skipped: false, type, isLate, isEarly };
}

/**
 * Diagnostic + real receiver — logs whatever a Hikvision device pushes
 * (multipart XML + snapshot, or raw XML/JSON), and if the payload contains
 * a recognizable person_id, records keldi/ketdi for the matching employee.
 */
export async function receiveDeviceEvent(req, res) {
  const receivedAt = new Date().toISOString();
  const stamp = Date.now();
  const deviceToken = req.params.token;

  console.log('\n========== DEVICE EVENT RECEIVED ==========');
  console.log('Time:', receivedAt);
  console.log('Method:', req.method);
  console.log('Device token (URL param):', deviceToken);
  console.log('From IP:', req.ip);
  console.log('Content-Type:', req.headers['content-type']);

  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Parsed body fields:');
    console.log(JSON.stringify(req.body, null, 2));
  }

  if (req.rawBody) {
    console.log('Raw body (first 3000 chars):');
    console.log(req.rawBody.slice(0, 3000));
  }

  if (req.files && req.files.length > 0) {
    console.log(`Files received: ${req.files.length}`);
    req.files.forEach((file, idx) => {
      console.log(
        `  [${idx}] field="${file.fieldname}" name="${file.originalname}" mime="${file.mimetype}" size=${file.size}B`
      );

      const ext = path.extname(file.originalname) || (file.mimetype.includes('jpeg') ? '.jpg' : '.bin');
      const savedName = `${stamp}_${idx}_${file.fieldname}${ext}`;
      fs.writeFileSync(path.join(eventsDir, savedName), file.buffer);
      console.log(`  -> saved as /uploads/device-events/${savedName}`);
    });
  }

  const candidates = getCandidateTexts(req);
  const personId = extractPersonId(candidates);

  if (!personId) {
    const heartbeat = isHeartbeat(candidates);
    console.log(
      heartbeat
        ? '(heartbeat)'
        : "(bu hodisada employeeNo/person_id topilmadi — ehtimol boshqa turdagi voqea)"
    );
    console.log('=============================================\n');
    await logDeviceEvent(deviceToken, heartbeat ? 'heartbeat' : 'boshqa', null, null);
    return res.status(200).json({ success: true });
  }

  console.log('Aniqlangan person_id:', personId);

  try {
    const employee = await findEmployeeByPersonId(personId);

    if (!employee) {
      console.log(`Person_id="${personId}" bo'yicha xodim topilmadi (employees.person_id mos kelmadi)`);
      console.log('=============================================\n');
      await logDeviceEvent(deviceToken, 'unmatched', personId, null);
      return res.status(200).json({ success: true });
    }

    const result = await recordAttendance(employee.id, deviceToken, personId);

    if (result.skipped) {
      console.log(`Xodim: ${employee.first_name} ${employee.last_name} — yozilmadi (${result.reason})`);
    } else {
      const lateNote = result.isLate === true ? ' (KECHIKDI)' : result.isLate === false ? ' (o\'z vaqtida)' : '';
      console.log(`Xodim: ${employee.first_name} ${employee.last_name} — "${result.type}" deb yozildi${lateNote}`);
    }

    await logDeviceEvent(deviceToken, 'access', personId, employee.id);
  } catch (err) {
    console.error('Davomat yozishda xatolik:', err.message);
    await logDeviceEvent(deviceToken, 'access', personId, null);
  }

  console.log('=============================================\n');
  res.status(200).json({ success: true });
}

// A device that hasn't been heard from in this long is considered offline —
// Hikvision heartbeats observed roughly every 30s, so a few missed beats
// still counts as alive without flapping the status on a single delay.
const TERMINAL_OFFLINE_AFTER_MS = 5 * 60 * 1000;

/**
 * GET /api/v1/devices/terminals — real device activity, derived from every
 * request a camera has ever made (device_events), not a manually configured
 * list. Powers Monitoring > Terminallar.
 */
export async function getTerminals(req, res) {
  try {
    const result = await query(
      `SELECT
         device_token,
         MAX(received_at) AS last_seen,
         COUNT(*) FILTER (WHERE received_at >= NOW() - INTERVAL '30 days') AS events_30d,
         COUNT(*) FILTER (WHERE event_type = 'access' AND received_at >= NOW() - INTERVAL '30 days') AS access_events_30d,
         COUNT(DISTINCT employee_id) FILTER (WHERE employee_id IS NOT NULL) AS matched_employees
       FROM device_events
       GROUP BY device_token
       ORDER BY last_seen DESC`
    );

    const now = Date.now();
    const terminals = result.rows.map((row) => ({
      deviceToken: row.device_token,
      lastSeen: row.last_seen,
      isOnline: now - new Date(row.last_seen).getTime() < TERMINAL_OFFLINE_AFTER_MS,
      events30d: Number(row.events_30d),
      accessEvents30d: Number(row.access_events_30d),
      matchedEmployees: Number(row.matched_employees),
    }));

    res.status(200).json({ success: true, message: 'Terminallar olindi', data: terminals, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Get terminals error:', err.message);
    res.status(500).json({ success: false, message: 'Terminallarni olishda xatolik', timestamp: new Date().toISOString() });
  }
}
