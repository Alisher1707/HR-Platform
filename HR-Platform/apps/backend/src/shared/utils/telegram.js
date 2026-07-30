import { config } from '../../config/env.js';

/**
 * Telegram Notifier
 * Best-effort debug notifications (e.g. incoming device/camera events) sent
 * to a Telegram chat — lets us see production activity without server/log
 * access. Silently no-ops if TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID aren't set,
 * and never throws — a notification failure must never break the request
 * it's reporting on.
 */
export async function notifyTelegram(text) {
  const { botToken, chatId } = config.telegram;
  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000), // Telegram message length limit
      }),
    });
  } catch (err) {
    console.error('Telegram notification failed:', err.message);
  }
}
