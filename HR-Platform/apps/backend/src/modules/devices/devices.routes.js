import express from 'express';
import multer from 'multer';
import Joi from 'joi';
import { receiveDeviceEvent, getTerminals, createDevice, deleteDevice } from './devices.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

const createDeviceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
});
const uuidParamSchema = Joi.object({ id: commonSchemas.uuid });
const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

// Memory storage — files are only inspected/saved manually in the controller,
// no need to persist through multer's disk storage for this diagnostic route.
const anyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
}).any();

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

  // For anything else (raw XML, unknown types) the body is still untouched here.
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks).toString('utf8');
    next();
  });
  req.on('error', next);
}

// ANY /api/v1/devices/:token/events - camera pushes face-recognition events here.
// Method is intentionally unrestricted (Hikvision has been seen using PUT for some
// pushes) while we're still confirming what this device actually sends. No auth:
// the device can't do our cookie/JWT auth.
router.all('/:token/events', captureDeviceEvent, receiveDeviceEvent);

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

// Catches anything under /api/v1/devices/* that doesn't match the route above —
// so a wrong path/method from the device still shows up in the logs instead of
// silently 404'ing.
router.all('*', (req, res) => {
  console.log(`\n(!) /api/v1/devices ostida mos kelmagan so'rov: ${req.method} ${req.originalUrl}`);
  res.status(200).json({ success: true });
});

export default router;
