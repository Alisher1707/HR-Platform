import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const appealsDir = path.join(__dirname, '../../../uploads/appeals');
if (!fs.existsSync(appealsDir)) {
  fs.mkdirSync(appealsDir, { recursive: true });
}

/**
 * Thin wrapper around the Telegram Bot API — plain `fetch`, no extra
 * dependency. Every export is a no-op (returns null) when
 * TELEGRAM_BOT_TOKEN isn't configured, so the rest of the app never has to
 * guard against a missing token itself.
 */
function apiUrl(method) {
  if (!config.telegram.botToken) return null;
  return `https://api.telegram.org/bot${config.telegram.botToken}/${method}`;
}

async function callApi(method, body) {
  const url = apiUrl(method);
  if (!url) return null;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API xatosi (${method}): ${data.description || 'noma\'lum xatolik'}`);
  }
  return data.result;
}

export async function getMe() {
  return callApi('getMe');
}

export async function sendMessage(chatId, text, { replyMarkup, parseMode } = {}) {
  return callApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    reply_markup: replyMarkup,
  });
}

export async function answerCallbackQuery(callbackQueryId, text) {
  return callApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

/** Resolves a Telegram file_id to a downloadable path + fetches its bytes. */
export async function downloadTelegramFile(fileId) {
  const file = await callApi('getFile', { file_id: fileId });
  if (!file || !file.file_path) return null;

  const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Telegram fayl yuklab olishda xatolik: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const ext = path.extname(file.file_path) || '';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(appealsDir, filename), buffer);

  return { fileUrl: `/uploads/appeals/${filename}`, fileName: path.basename(file.file_path) };
}

export async function getWebhookInfo() {
  return callApi('getWebhookInfo');
}

export async function setWebhook(url, secretToken) {
  return callApi('setWebhook', { url, secret_token: secretToken });
}

/**
 * Called once on backend startup. Skips entirely (with a clear log line)
 * when the bot token or a public base URL isn't configured — e.g. local
 * dev, which has no public HTTPS to receive Telegram's callbacks and must
 * not clobber whatever webhook production already has registered.
 */
export async function ensureWebhookRegistered() {
  if (!config.telegram.botToken) {
    console.log('ℹ️  Telegram bot: TELEGRAM_BOT_TOKEN yo\'q — apellatsiya boti o\'chiq.');
    return;
  }
  if (!config.telegram.webhookBaseUrl || !config.telegram.webhookSecret) {
    console.log('ℹ️  Telegram bot: TELEGRAM_WEBHOOK_BASE_URL/SECRET yo\'q — webhook ro\'yxatdan o\'tkazilmadi (masalan, lokal muhit).');
    return;
  }

  const targetUrl = `${config.telegram.webhookBaseUrl}/api/v1/telegram/webhook/${config.telegram.webhookSecret}`;

  try {
    const info = await getWebhookInfo();
    if (info && info.url === targetUrl) {
      console.log('✅ Telegram bot: webhook allaqachon to\'g\'ri o\'rnatilgan.');
      return;
    }
    await setWebhook(targetUrl, config.telegram.webhookSecret);
    console.log(`✅ Telegram bot: webhook o'rnatildi -> ${targetUrl}`);
  } catch (err) {
    console.error('❌ Telegram bot: webhook o\'rnatishda xatolik:', err.message);
  }
}
