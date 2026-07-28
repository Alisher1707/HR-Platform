import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../../config/database.js';

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
 * Pulls the camera's reported person/employee ID out of whatever text we
 * received (multipart text fields, raw body, or an XML/text file part) —
 * Hikvision access events carry it as <employeeNoString> or <employeeNo>.
 */
function extractPersonId(req) {
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

  for (const text of candidates) {
    const personId = extractTag(text, 'employeeNoString') || extractTag(text, 'employeeNo');
    if (personId) return personId;
  }

  return null;
}

async function findEmployeeByPersonId(personId) {
  const result = await query(
    'SELECT id, first_name, last_name FROM employees WHERE person_id = $1 LIMIT 1',
    [personId]
  );
  return result.rows[0] || null;
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

  await query(
    `INSERT INTO attendance_records (employee_id, type, device_token, raw_person_id)
     VALUES ($1, $2, $3, $4)`,
    [employeeId, type, deviceToken, rawPersonId]
  );

  return { skipped: false, type };
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

  const personId = extractPersonId(req);

  if (!personId) {
    console.log("(bu hodisada employeeNo/person_id topilmadi — ehtimol heartbeat yoki boshqa turdagi voqea)");
    console.log('=============================================\n');
    return res.status(200).json({ success: true });
  }

  console.log('Aniqlangan person_id:', personId);

  try {
    const employee = await findEmployeeByPersonId(personId);

    if (!employee) {
      console.log(`Person_id="${personId}" bo'yicha xodim topilmadi (employees.person_id mos kelmadi)`);
      console.log('=============================================\n');
      return res.status(200).json({ success: true });
    }

    const result = await recordAttendance(employee.id, deviceToken, personId);

    if (result.skipped) {
      console.log(`Xodim: ${employee.first_name} ${employee.last_name} — yozilmadi (${result.reason})`);
    } else {
      console.log(`Xodim: ${employee.first_name} ${employee.last_name} — "${result.type}" deb yozildi`);
    }
  } catch (err) {
    console.error('Davomat yozishda xatolik:', err.message);
  }

  console.log('=============================================\n');
  res.status(200).json({ success: true });
}
