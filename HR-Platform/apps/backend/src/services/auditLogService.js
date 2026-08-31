import { query } from '../config/database.js';

/**
 * Audit Log Service
 *
 * XAVFSIZLIK-AUDIT.md O-12 / P-8: imtiyozli amallarni (SUPER_ADMIN rol
 * tekshiruvini aylanib o'tish, xodimning PNFL/maoshi kabi nozik
 * ma'lumotini o'qish) qayd etadi.
 *
 * Ataylab "best-effort": bu yozuv HECH QACHON asosiy so'rovni
 * to'xtatmasligi kerak — audit jurnalining o'zi productionda yangi
 * nosozlik nuqtasiga aylanib qolmasligi uchun xato faqat log'ga
 * yoziladi, yuqoriga qaytarilmaydi.
 */
export async function recordAuditEvent({
  actorUserId = null,
  actorRole = null,
  action,
  resourceType = null,
  resourceId = null,
  ipAddress = null,
  meta = null,
}) {
  try {
    await query(
      `INSERT INTO audit_logs
        (actor_user_id, actor_role, action, resource_type, resource_id, ip_address, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        actorUserId,
        actorRole,
        action,
        resourceType,
        resourceId != null ? String(resourceId) : null,
        ipAddress,
        meta ? JSON.stringify(meta) : null,
      ]
    );
  } catch (error) {
    // Ataylab yutiladi — sabab yuqoridagi izohda. Chaqiruvchi hech qachon
    // audit yozuvi muvaffaqiyatsiz bo'lgani uchun 500 qaytarmasligi kerak.
    console.error("Audit log yozishda xatolik (e'tiborsiz qoldirildi):", error.message);
  }
}

/**
 * Har bir HTTP so'rovdan haqiqiy mijoz IP'sini oladi (Express'ning
 * o'zi allaqachon `trust proxy` bilan sozlangan — app.js'ga qarang).
 */
export function actorIp(req) {
  return req.ip || null;
}
