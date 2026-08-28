/**
 * Telefon raqamini bir xil ko'rinishga keltiradi: "+998 90 123 45 67".
 *
 * Bazada raqam turlicha shaklda saqlanadi — Excel'dan import qilingani
 * fayldagi bo'shliqlarni saqlab qoladi ("+998 93 987 65 43"), qo'lda
 * kiritilgani esa ko'pincha xom raqam ("998933213144"). Ma'lumotning
 * o'zini bazada o'zgartirish xavfli (qidiruv/filtrlar unga bog'liq bo'lishi
 * mumkin) — shuning uchun faqat KO'RSATISHDA bir xil dizaynga keltiramiz,
 * saqlangan qiymatning o'ziga tegilmaydi.
 */
export function formatPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';

  // 998 bilan boshlangan 12 xonali (mamlakat kodi bilan) yoki 9 xonali
  // (mamlakat kodisiz) o'zbek raqami — ikkalasi ham shu shaklga tushadi.
  const local = digits.startsWith('998') && digits.length === 12
    ? digits.slice(3)
    : digits.length === 9
      ? digits
      : null;

  if (!local) return phone; // Kutilmagan uzunlik — o'zgartirmasdan, xomligicha ko'rsatamiz.

  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

export default formatPhone;
