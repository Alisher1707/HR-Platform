import express from 'express';
import { receiveTelegramUpdate } from './telegram.controller.js';
import { config } from '../../config/env.js';

const router = express.Router();

/**
 * Telegram can't do our cookie/JWT auth, so the URL-embedded secret
 * (TELEGRAM_WEBHOOK_SECRET) is what stands in for auth here — same
 * rationale/shape as the Hikvision device webhook's `:token` param
 * (devices.routes.js). A request with a wrong/missing secret gets a plain
 * 404 rather than a body that would reveal whether the route exists.
 */
router.post('/webhook/:secret', (req, res, next) => {
  if (!config.telegram.webhookSecret || req.params.secret !== config.telegram.webhookSecret) {
    return res.status(404).end();
  }
  return next();
}, receiveTelegramUpdate);

export default router;
