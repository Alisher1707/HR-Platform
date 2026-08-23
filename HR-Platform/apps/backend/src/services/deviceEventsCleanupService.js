import { query } from '../config/database.js';

/**
 * Device Events Cleanup Service
 *
 * Kamera "heartbeat" hodisalari har ~30 soniyada keladi va faqat
 * "qurilma tirikmi" degan savolga javob berish uchun kerak (Monitoring >
 * Terminallar shu jadvaldan `last_seen`/`isOnline` hisoblaydi) — shuning
 * uchun ular abadiy saqlanishining hech qanday amaliy foydasi yo'q va
 * jadvalni cheksiz kattalashtirib boradi. Haqiqiy audit ahamiyatiga ega
 * bo'lgan hodisalar ("access" — xodim aniqlangan/aniqlanmagan kirish
 * urinishlari) esa abadiy saqlanadi.
 *
 * 30 kunlik chegara — Monitoring'dagi "oxirgi 30 kun" statistikasi
 * (getTerminals) to'liq ishlashi uchun yetarlicha uzoq, shu bilan birga
 * jadval hajmini nazoratda ushlab turadi.
 */
const RETENTION_DAYS = 30;
const PRUNABLE_EVENT_TYPES = ['heartbeat', 'boshqa'];

export async function cleanupOldDeviceEvents() {
  const result = await query(
    `DELETE FROM device_events
     WHERE event_type = ANY($1)
       AND received_at < NOW() - ($2 || ' days')::INTERVAL`,
    [PRUNABLE_EVENT_TYPES, RETENTION_DAYS]
  );
  return { deleted: result.rowCount };
}

/**
 * Kuniga bir marta ishga tushadi — bu jadval boshqalarga qaraganda
 * ancha sekin o'sadi (kunlik ~3000 qator), shuning uchun tez-tez
 * tekshirishga hojat yo'q.
 */
export function startDeviceEventsCleanupCron() {
  const INTERVAL = 24 * 60 * 60 * 1000;

  console.log('🚀 Starting device-events cleanup cron job (runs every 24 hours)');

  cleanupOldDeviceEvents()
    .then((result) => {
      if (result.deleted > 0) console.log(`✅ Initial cleanup: ${result.deleted} ta eski device_events o'chirildi`);
    })
    .catch((err) => console.error('❌ Initial device-events cleanup failed:', err));

  setInterval(async () => {
    try {
      const result = await cleanupOldDeviceEvents();
      if (result.deleted > 0) console.log(`✅ Cron: ${result.deleted} ta eski device_events o'chirildi`);
    } catch (error) {
      console.error('❌ Cron device-events cleanup failed:', error);
    }
  }, INTERVAL);
}
