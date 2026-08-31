import express from 'express';
import crypto from 'crypto';
import { receiveTelegramUpdate } from './telegram.controller.js';
import { config } from '../../config/env.js';

const router = express.Router();

/**
 * Telegram can't do our cookie/JWT auth, so TELEGRAM_WEBHOOK_SECRET stands
 * in for auth here. It used to be embedded in the URL path (`/webhook/:secret`)
 * and compared with plain `!==` — that put the secret in nginx's access
 * log (and any backup/aggregator that ingests it) on every single update,
 * and a non-constant-time compare leaks timing information. Telegram's Bot
 * API already sends the secret back as the `X-Telegram-Bot-Api-Secret-Token`
 * header on every webhook call (see telegramApi.js#setWebhook, which has
 * always passed `secret_token` — it just wasn't being checked), so the
 * secret never needs to appear in the URL at all now
 * (XAVFSIZLIK-AUDIT.md O-2).
 */
router.post('/webhook', (req, res, next) => {
  const expected = config.telegram.webhookSecret;
  const received = req.headers['x-telegram-bot-api-secret-token'];

  if (!expected || typeof received !== 'string') {
    return res.status(404).end();
  }

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(received);
  const matches = expectedBuf.length === receivedBuf.length
    && crypto.timingSafeEqual(expectedBuf, receivedBuf);

  if (!matches) {
    return res.status(404).end();
  }
  return next();
}, receiveTelegramUpdate);

export default router;
