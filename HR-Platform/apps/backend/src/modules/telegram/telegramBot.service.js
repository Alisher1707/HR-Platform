import { query } from '../../config/database.js';
import * as telegramApi from './telegramApi.js';
import * as finesService from '../fines/fines.service.js';

/**
 * Fine-appeal Telegram bot — a small text/inline-keyboard conversation.
 * State lives in `telegram_bot_sessions` (DB-backed, not in-memory) so an
 * in-progress conversation survives a backend restart/redeploy, which this
 * project does often.
 */

const MAIN_MENU_KEYBOARD = {
  keyboard: [['📋 Jarimalar'], ['📝 Ariza yuborish']],
  resize_keyboard: true,
};

const NO_FILE_ANSWERS = ["yo'q", 'yoq', "yo'q.", 'yoq.', 'yo`q', 'yo‘q'];
const TODAY_ANSWERS = ['bugun', 'bugun.'];

const ARIZA_CATEGORIES = [
  { value: 'kech_kelish', label: 'Kechikib qolish', emoji: '⏰' },
  { value: 'erta_ketish', label: 'Ishdan ertaroq ketish', emoji: '🚪' },
  { value: 'chiqish_yoq', label: "Chiqishni belgilamagan", emoji: '🚫' },
  { value: 'kelmagan_kun', label: 'Ishga kelmagan kun', emoji: '📅' },
  { value: 'umumiy', label: "Javob so'rash / Boshqa", emoji: '❓' },
];

async function findEmployeeByChatId(chatId) {
  const { rows } = await query(
    'SELECT id, first_name, last_name FROM employees WHERE telegram_chat_id = $1',
    [chatId]
  );
  return rows[0] || null;
}

/** person_id — Xodimlar ro'yxatida "ID: 1038" tarzida ko'rinadigan, har bir xodimga tizim tomonidan berilgan raqam. */
async function findEmployeeByPersonId(personId) {
  const { rows } = await query(
    'SELECT id, first_name, last_name FROM employees WHERE person_id = $1',
    [personId]
  );
  return rows[0] || null;
}

async function linkChatToEmployee(chatId, employeeId) {
  // A chat_id can only belong to one employee at a time — detach it from
  // whoever held it before (re-linking scenario) to avoid the unique
  // constraint rejecting the new link.
  await query('UPDATE employees SET telegram_chat_id = NULL WHERE telegram_chat_id = $1', [chatId]);
  await query('UPDATE employees SET telegram_chat_id = $1 WHERE id = $2', [chatId, employeeId]);
}

async function getSession(chatId) {
  const { rows } = await query('SELECT * FROM telegram_bot_sessions WHERE chat_id = $1', [chatId]);
  return rows[0] || null;
}

async function saveSession(chatId, employeeId, state, draft) {
  await query(
    `INSERT INTO telegram_bot_sessions (chat_id, employee_id, state, draft, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (chat_id) DO UPDATE SET employee_id = $2, state = $3, draft = $4, updated_at = NOW()`,
    [chatId, employeeId, state, draft ? JSON.stringify(draft) : null]
  );
}

async function clearSession(chatId) {
  await query('DELETE FROM telegram_bot_sessions WHERE chat_id = $1', [chatId]);
}

function formatFineLine(fine) {
  const date = fine.violationDate || (fine.createdAt ? String(fine.createdAt).slice(0, 10) : '');
  const type = fine.fineTypeName || 'Jarima';
  return `⚠️ ${Number(fine.amount).toLocaleString('ru-RU')} so'm — ${type} — ${date}`;
}

async function sendMainMenu(chatId, employee, greeting) {
  const text = greeting || `Xush kelibsiz, ${employee.first_name} ${employee.last_name}!`;
  await telegramApi.sendMessage(chatId, text, { replyMarkup: MAIN_MENU_KEYBOARD });
}

/**
 * Unlinked chat — every message gets the same instruction until the
 * employee sends a valid person_id. No code, no HR step: the employee
 * already knows their own ID (visible to them / assigned by HR), so this
 * links immediately and self-service, same as before with codes but with
 * one less round trip.
 */
async function handleUnlinkedChat(chatId, rawText) {
  const trimmed = (rawText || '').trim();

  if (!trimmed || trimmed.startsWith('/start')) {
    await telegramApi.sendMessage(chatId, "Botdan foydalanish uchun ID raqamingizni yuboring (masalan: 1038).");
    return;
  }

  const personId = trimmed.replace(/[^0-9]/g, '');
  if (!personId) {
    await telegramApi.sendMessage(chatId, 'Iltimos, faqat ID raqamingizni yuboring (masalan: 1038).');
    return;
  }

  const employee = await findEmployeeByPersonId(personId);
  if (!employee) {
    await telegramApi.sendMessage(chatId, 'Bunday ID topilmadi. ID raqamingizni tekshirib qayta yuboring, yoki HR\'ga murojaat qiling.');
    return;
  }

  await linkChatToEmployee(chatId, employee.id);
  await sendMainMenu(chatId, employee, `✅ Xush kelibsiz, ${employee.first_name} ${employee.last_name}!`);
}

async function handleFinesListRequest(chatId, employee) {
  const fines = await finesService.listEmployeeFines({ employeeId: employee.id });
  const active = fines.filter((f) => f.status === 'faol');

  if (active.length === 0) {
    await telegramApi.sendMessage(chatId, "Sizda hozircha faol jarima yo'q. ✅");
    return;
  }

  const text = ['📋 Faol jarimalaringiz:', ...active.slice(0, 20).map(formatFineLine)].join('\n');
  await telegramApi.sendMessage(chatId, text);
}

async function handleArizaStartRequest(chatId, employee) {
  const keyboard = {
    inline_keyboard: ARIZA_CATEGORIES.map((c) => [{ text: `${c.emoji} ${c.label}`, callback_data: `ariza_cat:${c.value}` }]),
  };
  await telegramApi.sendMessage(chatId, "Ariza turini tanlang:", { replyMarkup: keyboard });
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data || '';

  // Best-effort only — this just stops the client-side loading spinner.
  // A stale/invalid callback_query_id (Telegram expires them) must never
  // block the actual business logic below.
  telegramApi.answerCallbackQuery(callbackQuery.id).catch(() => {});

  const employee = await findEmployeeByChatId(chatId);
  if (!employee) return;

  if (data.startsWith('ariza_cat:')) {
    const category = data.slice('ariza_cat:'.length);
    const label = ARIZA_CATEGORIES.find((c) => c.value === category)?.label || category;
    await saveSession(chatId, employee.id, 'awaiting_date', { category });
    await telegramApi.sendMessage(
      chatId,
      `"${label}" — qaysi sana uchun? "Bugun" deb yozing yoki sanani kiriting (kun.oy.yil, masalan 18.08.2026).`
    );
  }
}

/** Accepts "Bugun" or DD.MM.YYYY, returns an ISO (YYYY-MM-DD) date string or null. */
function parseIncidentDate(text) {
  const trimmed = (text || '').trim().toLowerCase();
  if (TODAY_ANSWERS.includes(trimmed)) {
    return new Date().toISOString().slice(0, 10);
  }

  const match = trimmed.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const d = Number(day);
  const m = Number(month);
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;

  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function handleAwaitingDate(chatId, employee, session, message) {
  const incidentDate = parseIncidentDate(message.text);
  if (!incidentDate) {
    await telegramApi.sendMessage(chatId, 'Sana tushunarsiz. "Bugun" deb yozing yoki kun.oy.yil formatida kiriting (masalan 18.08.2026).');
    return;
  }

  const draft = { ...session.draft, incidentDate };
  await saveSession(chatId, employee.id, 'awaiting_reason', draft);
  await telegramApi.sendMessage(chatId, 'Sababingizni batafsil yozing:');
}

async function submitAriza(chatId, employee, draft, { fileUrl, fileName } = {}) {
  try {
    await finesService.createFineAppeal({
      employeeId: employee.id,
      category: draft.category,
      incidentDate: draft.incidentDate,
      reason: draft.reason,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
    });
    await clearSession(chatId);
    await telegramApi.sendMessage(chatId, '✅ Arizangiz yuborildi. HR javobini kuting — natija shu yerdan xabar qilinadi.');
    await sendMainMenu(chatId, employee, 'Boshqa nima qilmoqchisiz?');
  } catch (err) {
    await clearSession(chatId);
    await telegramApi.sendMessage(chatId, `Arizani yuborib bo'lmadi: ${err.message}`);
    await sendMainMenu(chatId, employee, 'Boshqa nima qilmoqchisiz?');
  }
}

async function handleAwaitingReason(chatId, employee, session, message) {
  if (!message.text) {
    await telegramApi.sendMessage(chatId, "Iltimos, sababni matn ko'rinishida yozing.");
    return;
  }

  const draft = { ...session.draft, reason: message.text.trim() };
  await saveSession(chatId, employee.id, 'awaiting_file', draft);
  await telegramApi.sendMessage(
    chatId,
    "Hujjat (rasm yoki fayl) biriktirasizmi? Yuborishingiz mumkin, yoki \"Yo'q\" deb yozing."
  );
}

async function handleAwaitingFile(chatId, employee, session, message) {
  const draft = session.draft;

  if (message.text && NO_FILE_ANSWERS.includes(message.text.trim().toLowerCase())) {
    await submitAriza(chatId, employee, draft);
    return;
  }

  const photo = message.photo && message.photo.length > 0 ? message.photo[message.photo.length - 1] : null;
  const fileId = photo ? photo.file_id : message.document ? message.document.file_id : null;

  if (!fileId) {
    await telegramApi.sendMessage(chatId, 'Iltimos, rasm/fayl yuboring yoki "Yo\'q" deb yozing.');
    return;
  }

  try {
    const downloaded = await telegramApi.downloadTelegramFile(fileId);
    await submitAriza(chatId, employee, draft, downloaded || {});
  } catch (err) {
    await telegramApi.sendMessage(chatId, `Faylni yuklab olishda xatolik: ${err.message}. Qayta urinib ko'ring yoki "Yo'q" deb yozing.`);
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const employee = await findEmployeeByChatId(chatId);

  if (!employee) {
    await handleUnlinkedChat(chatId, message.text || '');
    return;
  }

  const session = await getSession(chatId);

  if (session && session.state === 'awaiting_date') {
    await handleAwaitingDate(chatId, employee, session, message);
    return;
  }
  if (session && session.state === 'awaiting_reason') {
    await handleAwaitingReason(chatId, employee, session, message);
    return;
  }
  if (session && session.state === 'awaiting_file') {
    await handleAwaitingFile(chatId, employee, session, message);
    return;
  }

  const text = (message.text || '').trim();
  if (text === '📋 Jarimalar') {
    await handleFinesListRequest(chatId, employee);
    return;
  }
  if (text === '📝 Ariza yuborish') {
    await handleArizaStartRequest(chatId, employee);
    return;
  }

  await sendMainMenu(chatId, employee, 'Quyidagi menyudan tanlang:');
}

export async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

/** Called by fines.controller after reviewFineAppeal — best-effort, never throws. */
export async function notifyAppealReviewed(employeeId, { status, note, fineAmount, fineTypeName }) {
  try {
    const { rows } = await query('SELECT telegram_chat_id FROM employees WHERE id = $1', [employeeId]);
    const chatId = rows[0] && rows[0].telegram_chat_id;
    if (!chatId) return;

    const fineNote = fineTypeName
      ? ` "${fineTypeName}" (${Number(fineAmount).toLocaleString('ru-RU')} so'm) jarimasi bekor qilindi.`
      : '';
    const text = status === 'tasdiqlandi'
      ? `✅ Arizangiz tasdiqlandi.${fineNote}`
      : `❌ Arizangiz rad etildi.${note ? `\nSabab: ${note}` : ''}`;

    await telegramApi.sendMessage(chatId, text);
  } catch (err) {
    console.error('Telegram bot: apellatsiya natijasini xabar qilishda xatolik:', err.message);
  }
}
