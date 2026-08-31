import express from 'express';
import multer from 'multer';
import Joi from 'joi';
import { receiveDeviceEvent, getTerminals, createDevice, deleteDevice, deleteUnregisteredDevice } from './devices.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { deviceEventLimiter, deviceUnknownTokenLimiter } from '../../shared/middleware/rateLimiter.js';
import { USER_ROLES } from '../../config/constants.js';
import { query } from '../../config/database.js';

const router = express.Router();

const createDeviceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
});
const uuidParamSchema = Joi.object({ id: commonSchemas.uuid });
const tokenParamSchema = Joi.object({ token: Joi.string().trim().min(1).max(200).required() });
const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

// Memory storage — files are only inspected/saved manually in the controller,
// no need to persist through multer's disk storage for this diagnostic route.
//
// XAVFSIZLIK-AUDIT.md (3-pass, #10): `fileSize` alone bounds ONE file, and
// `.any()` accepts an unlimited NUMBER of them — with memoryStorage that
// was unbounded RAM for a single request. A Hikvision access event carries
// at most a couple of small snapshots, so both dimensions are now capped.
const anyUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 5,
    fields: 50,
    parts: 60,
  },
}).any();

// Non-multipart device payloads (Hikvision XML/JSON) are a few KB at most.
// The old raw-body capture had NO ceiling at all — see captureDeviceEvent.
const MAX_RAW_BODY_BYTES = 2 * 1024 * 1024;

/**
 * XAVFSIZLIK-AUDIT.md (3-pass, #10) — the single most important fix on this
 * route: resolve (and therefore AUTHENTICATE) the device token BEFORE any
 * request body is read.
 *
 * Previously the order was: rate limiter (keyed by the attacker-controlled
 * token) -> body capture (unbounded) -> controller -> token check. So an
 * unauthenticated caller with a completely made-up token could stream an
 * arbitrarily large body straight into the server's memory, and only after
 * all of it was buffered did the token get rejected with a 404. Verified
 * live: an 80 MB `application/xml` POST with a bogus token was fully
 * buffered before the 404 (`express.json`'s 1 MB limit never applied — it
 * only covers JSON content types).
 *
 * Now an unknown token is rejected while the request stream is still
 * paused and unread, so TCP backpressure caps what the process ever holds.
 * The resolved row is attached to `req.device` so the controller doesn't
 * repeat the lookup.
 */
async function resolveDeviceOr404(req, res, next) {
  try {
    const { rows } = await query('SELECT id FROM devices WHERE token = $1 LIMIT 1', [req.params.token]);
    if (rows.length === 0) {
      const token = req.params.token || '';
      const masked = token ? `${token.slice(0, 4)}…${token.slice(-4)} (${token.length} belgi)` : "(yo'q)";
      console.log(`(!) Noma'lum device token bilan so'rov rad etildi (tana o'qilmadi): ${masked}`);
      return res.status(404).json({ success: false, message: "Noma'lum qurilma" });
    }
    req.device = rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Hikvision (and similar) push events as multipart/form-data.
 * Content-type is unknown until the real device fires, so:
 *  - multipart requests go through multer (.any() accepts any field name)
 *  - everything else is captured as a raw string so nothing gets silently dropped
 */
function captureDeviceEvent(req, res, next) {
  const contentType = req.headers['content-type'] || '';

  if (contentType.startsWith('multipart/form-data')) {
    return anyUpload(req, res, (err) => {
      if (err) {
        console.error('Device event multipart parse error:', err.message);
      }
      next();
    });
  }

  // express.json()/urlencoded() are mounted globally (app.js) and already
  // consume the stream for content-types they match, BEFORE this middleware
  // runs. Attaching 'data'/'end' listeners to an already-ended stream would
  // never fire and hang the request forever — skip straight to next() then.
  if (req.readableEnded || req.complete) {
    return next();
  }

  // For anything else (raw XML, unknown types) the body is still untouched
  // here. This used to accumulate chunks with no ceiling whatsoever — the
  // memory-exhaustion half of XAVFSIZLIK-AUDIT.md (3-pass, #10). Now it
  // stops (and drops the connection) the moment the payload exceeds what a
  // real device event could possibly be.
  const chunks = [];
  let received = 0;
  let aborted = false;

  req.on('data', (chunk) => {
    if (aborted) return;
    received += chunk.length;
    if (received > MAX_RAW_BODY_BYTES) {
      aborted = true;
      chunks.length = 0;
      console.warn(`(!) Device event tanasi juda katta (>${MAX_RAW_BODY_BYTES} bayt) — rad etildi`);
      res.status(413).json({ success: false, message: "So'rov tanasi juda katta" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    req.rawBody = Buffer.concat(chunks).toString('utf8');
    next();
  });
  req.on('error', (err) => {
    if (aborted) return;
    next(err);
  });
}

// ANY /api/v1/devices/:token/events - camera pushes face-recognition events here.
// Method is intentionally unrestricted (Hikvision has been seen using PUT for some
// pushes) while we're still confirming what this device actually sends. No auth:
// the device can't do our cookie/JWT auth. deviceEventLimiter (keyed by token,
// not IP — see rateLimiter.js) replaces the general limiter here so several
// cameras sharing one branch's public IP don't compete for the same quota.
// Tartib MUHIM (XAVFSIZLIK-AUDIT.md 3-pass, #10):
//   1. deviceUnknownTokenLimiter — IP bo'yicha, faqat MUVAFFAQIYATSIZ
//      (4xx) so'rovlarni sanaydi, shuning uchun bitta NAT ortidagi haqiqiy
//      kameralar (200 qaytaradi) hech qachon hisobga olinmaydi.
//   2. deviceEventLimiter — token bo'yicha; o'zi yolg'iz yetarli emas
//      (token — chaqiruvchi nazoratidagi yo'l qismi), lekin bitta
//      "aylanib qolgan" haqiqiy qurilmani cheklash uchun to'g'ri kalit.
//   3. resolveDeviceOr404 — TANA O'QILISHIDAN OLDIN tokenni tekshiradi.
//   4. captureDeviceEvent — endi ikkala yo'lda ham (multipart va xom)
//      qat'iy chegara bilan.
router.all(
  '/:token/events',
  deviceUnknownTokenLimiter,
  deviceEventLimiter,
  resolveDeviceOr404,
  captureDeviceEvent,
  receiveDeviceEvent
);

// GET /api/v1/devices/terminals - real device activity for Monitoring > Terminallar
// (dashboard-facing, so it needs auth — unlike the camera-facing route above).
router.get('/terminals', authenticate, canManage, getTerminals);

// POST /api/v1/devices - register a new device, auto-generates its token
router.post('/', authenticate, canManage, validate(createDeviceSchema), createDevice);

// DELETE /api/v1/devices/:id - remove a registered device
router.delete(
  '/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  deleteDevice
);

// DELETE /api/v1/devices/by-token/:token - remove an "unregistered" terminal
// (a device_token seen in real camera traffic that was never created via
// "Qurilma yaratish", so it has no devices.id to delete by). There's no
// device row for these — the only thing making them show up in Terminallar
// is their device_events history, so removing one here purges that history
// for good (stale/test tokens, e.g. "test-token", never come back once
// deleted — unless the same token pushes a new event later).
router.delete(
  '/by-token/:token',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(tokenParamSchema),
  deleteUnregisteredDevice
);

// Catches anything under /api/v1/devices/* that doesn't match the route above —
// so a wrong path/method from the device still shows up in the logs instead of
// silently 404'ing.
router.all('*', (req, res) => {
  console.log(`\n(!) /api/v1/devices ostida mos kelmagan so'rov: ${req.method} ${req.originalUrl}`);
  // Was previously 200 {success:true} for anything unmatched — convenient
  // for "blind" probing by an attacker and masked genuine client bugs
  // behind a false-success response (XAVFSIZLIK-AUDIT.md P-3).
  res.status(404).json({ success: false, message: 'Not found' });
});

export default router;
