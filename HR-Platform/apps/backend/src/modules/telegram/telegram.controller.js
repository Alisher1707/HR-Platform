import { handleUpdate } from './telegramBot.service.js';

/**
 * POST /api/v1/telegram/webhook/:secret
 * Telegram calls this for every update (message, callback_query, ...). The
 * URL-embedded secret is checked in the route middleware before this ever
 * runs. Always answers 200 immediately after processing — Telegram retries
 * aggressively on non-2xx, so a bug here must never surface as an HTTP
 * error back to Telegram, only as a server-side log line.
 */
export async function receiveTelegramUpdate(req, res) {
  res.status(200).json({ ok: true });

  try {
    await handleUpdate(req.body || {});
  } catch (err) {
    console.error('Telegram webhook: yangilanishni qayta ishlashda xatolik:', err.message);
  }
}
