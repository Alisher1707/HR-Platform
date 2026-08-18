import { query } from '../../config/database.js';
import * as telegramApi from './telegramApi.js';
import * as finesService from '../fines/fines.service.js';
import { generateLinkCode } from '../../shared/utils/crypto.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Fine-appeal Telegram bot — a small text/inline-keyboard conversation.
 * State lives in `telegram_bot_sessions` (DB-backed, not in-memory) so an
 * in-progress conversation survives a backend restart/redeploy, which this
 * project does often.
 */

const MAIN_MENU_KEYBOARD = {
  keyboard: [['📋 Jarimalarim'], ['📝 Tushuntirish xati yuborish']],
  resize_keyboard: true,
};

const NO_FILE_ANSWERS = ["yo'q", 'yoq', "yo'q.", 'yoq.', 'yo`q', 'yo‘q'];

async function findEmployeeByChatId(chatId) {
  const { rows } = await query(
    'SELECT id, first_name, last_name FROM employees WHERE telegram_chat_id = $1',
    [chatId]
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
  return `• ${Number(fine.amount).toLocaleString('ru-RU')} so'm — ${type} — ${date}`;
}

async function sendMainMenu(chatId, employee, greeting) {
  const text = greeting || `Xush kelibsiz, ${employee.first_name} ${employee.last_name}!`;
  await telegramApi.sendMessage(chatId, text, { replyMarkup: MAIN_MENU_KEYBOARD });
}

/**
 * Returns this chat's not-yet-claimed code, generating one on first
 * contact and reusing it on every later /start until HR claims it — so
 * pressing Start repeatedly never produces a different code.
 */
async function ensurePendingCode(chatId) {
  const existing = await query('SELECT pending_code FROM telegram_bot_sessions WHERE chat_id = $1', [chatId]);
  if (existing.rows[0]?.pending_code) return existing.rows[0].pending_code;

  // Collisions are astronomically unlikely (32^6 possibilities) but trivial
  // to guard against — retry with a fresh code on the rare unique clash.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateLinkCode();
    try {
      await query(
        `INSERT INTO telegram_bot_sessions (chat_id, pending_code, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET pending_code = $2, updated_at = NOW()`,
        [chatId, code]
      );
      return code;
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error("Kod yaratib bo'lmadi, qayta urinib ko'ring");
}

/**
 * Every unlinked chat gets the SAME reply, whatever they send — the bot
 * hands them their own unique code and tells them to relay it to HR. HR
 * completes the link from the admin panel (claimPendingCode below), so a
 * random person contacting the bot never gets attached to any employee on
 * their own.
 */
async function handleUnlinkedChat(chatId) {
  const code = await ensurePendingCode(chatId);
  await telegramApi.sendMessage(
    chatId,
    `Botdan foydalanish uchun ushbu kodni HR'ga ayting: (${code})\n\nHR kodni tizimda tasdiqlagach, botdan foydalana olasiz.`
  );
}

/**
 * Called from the employees module when HR submits the code an employee
 * relayed to them (POST /employees/:id/telegram-claim-code). Links that
 * chat to the given employee and notifies them via the bot.
 */
export async function claimPendingCode(rawCode, employeeId) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) {
    const error = new Error('Kodni kiriting');
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  const { rows } = await query('SELECT chat_id FROM telegram_bot_sessions WHERE pending_code = $1', [code]);
  if (rows.length === 0) {
    const error = new Error("Kod topilmadi yoki eskirgan — xodimdan botga qayta /start bosishini so'rang");
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const chatId = rows[0].chat_id;
  await linkChatToEmployee(chatId, employeeId);
  await query('UPDATE telegram_bot_sessions SET pending_code = NULL WHERE chat_id = $1', [chatId]);

  const { rows: empRows } = await query('SELECT first_name, last_name FROM employees WHERE id = $1', [employeeId]);
  const employee = empRows[0];
  if (employee) {
    // Best-effort — a failed Telegram delivery must never fail HR's claim request.
    sendMainMenu(chatId, employee, `✅ HR tomonidan tasdiqlandi! Xush kelibsiz, ${employee.first_name} ${employee.last_name}.`)
      .catch((err) => console.error('Telegram: tasdiqlash xabarini yuborishda xatolik:', err.message));
  }
}

async function handleFinesListRequest(chatId, employee) {
  const fines = await finesService.listEmployeeFines({ employeeId: employee.id });
  const active = fines.filter((f) => f.status === 'faol');

  if (active.length === 0) {
    await telegramApi.sendMessage(chatId, 'Sizda hozircha faol jarima yo\'q.');
    return;
  }

  const text = ['Faol jarimalaringiz:', ...active.slice(0, 20).map(formatFineLine)].join('\n');
  await telegramApi.sendMessage(chatId, text);
}

async function handleAppealStartRequest(chatId, employee) {
  const fines = await finesService.listAppealableFinesForEmployee(employee.id);

  if (fines.length === 0) {
    await telegramApi.sendMessage(
      chatId,
      "Hozircha tushuntirish xati yuborish mumkin bo'lgan jarima yo'q (yo faol jarima yo'q, yo hammasi bo'yicha ariza allaqachon yuborilgan)."
    );
    return;
  }

  const keyboard = {
    inline_keyboard: fines.map((f) => [
      { text: formatFineLine(f).replace(/^•\s*/, ''), callback_data: `appeal_fine:${f.id}` },
    ]),
  };
  await telegramApi.sendMessage(chatId, 'Qaysi jarima uchun tushuntirish xati yubormoqchisiz?', {
    replyMarkup: keyboard,
  });
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

  if (data.startsWith('appeal_fine:')) {
    const fineId = data.slice('appeal_fine:'.length);
    await saveSession(chatId, employee.id, 'awaiting_reason', { fineId });
    await telegramApi.sendMessage(chatId, 'Sababini batafsil yozib yuboring:');
  }
}

async function submitAppeal(chatId, employee, draft, { fileUrl, fileName } = {}) {
  try {
    await finesService.createFineAppeal({
      employeeFineId: draft.fineId,
      employeeId: employee.id,
      reason: draft.reason,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
    });
    await clearSession(chatId);
    await telegramApi.sendMessage(chatId, '✅ Arizangiz yuborildi. HR javobini kuting — tasdiqlansa, sizga shu yerdan xabar beriladi.');
    await sendMainMenu(chatId, employee, 'Boshqa nima qilmoqchisiz?');
  } catch (err) {
    await clearSession(chatId);
    await telegramApi.sendMessage(chatId, `Arizani yuborib bo'lmadi: ${err.message}`);
    await sendMainMenu(chatId, employee, 'Boshqa nima qilmoqchisiz?');
  }
}

async function handleAwaitingReason(chatId, employee, session, message) {
  if (!message.text) {
    await telegramApi.sendMessage(chatId, 'Iltimos, sababni matn ko\'rinishida yozing.');
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
    await submitAppeal(chatId, employee, draft);
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
    await submitAppeal(chatId, employee, draft, downloaded || {});
  } catch (err) {
    await telegramApi.sendMessage(chatId, `Faylni yuklab olishda xatolik: ${err.message}. Qayta urinib ko'ring yoki "Yo'q" deb yozing.`);
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const employee = await findEmployeeByChatId(chatId);

  if (!employee) {
    await handleUnlinkedChat(chatId);
    return;
  }

  const session = await getSession(chatId);

  if (session && session.state === 'awaiting_reason') {
    await handleAwaitingReason(chatId, employee, session, message);
    return;
  }
  if (session && session.state === 'awaiting_file') {
    await handleAwaitingFile(chatId, employee, session, message);
    return;
  }

  const text = (message.text || '').trim();
  if (text === '📋 Jarimalarim') {
    await handleFinesListRequest(chatId, employee);
    return;
  }
  if (text === '📝 Tushuntirish xati yuborish') {
    await handleAppealStartRequest(chatId, employee);
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

/** Called by fines.service.reviewFineAppeal — best-effort, never throws. */
export async function notifyAppealReviewed(employeeId, { status, note, fineAmount, fineTypeName }) {
  try {
    const { rows } = await query('SELECT telegram_chat_id FROM employees WHERE id = $1', [employeeId]);
    const chatId = rows[0] && rows[0].telegram_chat_id;
    if (!chatId) return;

    const label = fineTypeName ? `${fineTypeName} (${Number(fineAmount).toLocaleString('ru-RU')} so'm)` : 'Jarima';
    const text = status === 'tasdiqlandi'
      ? `✅ Arizangiz tasdiqlandi. "${label}" jarimasi bekor qilindi.`
      : `❌ Arizangiz rad etildi.${note ? `\nSabab: ${note}` : ''}`;

    await telegramApi.sendMessage(chatId, text);
  } catch (err) {
    console.error('Telegram bot: apellatsiya natijasini xabar qilishda xatolik:', err.message);
  }
}
