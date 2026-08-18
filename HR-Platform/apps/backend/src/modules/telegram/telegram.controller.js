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

  const update = req.body || {};
  const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
  const text = update.message?.text;
  const callbackData = update.callback_query?.data;
  console.log(
    `Telegram update: chat=${chatId ?? '?'}` +
    (text !== undefined ? ` text=${JSON.stringify(text)}` : '') +
    (callbackData !== undefined ? ` callback=${JSON.stringify(callbackData)}` : '')
  );

  try {
    await handleUpdate(update);
  } catch (err) {
    console.error('Telegram webhook: yangilanishni qayta ishlashda xatolik:', err.message);
  }
}
