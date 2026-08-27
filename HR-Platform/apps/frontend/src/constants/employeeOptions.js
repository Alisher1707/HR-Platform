/**
 * Xodim kartochkasidagi Filial / Bo'lim / Lavozim ro'yxatlari.
 *
 * Bu ro'yxatlar ilgari faqat EmployeeForm.jsx ichida qattiq yozilgan edi.
 * Excel'dan import qo'shilgach, ikkinchi joy ham xuddi shu qiymatlarni
 * bilishi kerak bo'ldi: bazada `sayxun`, `oquv`, `mentor` kabi KICHIK
 * harfli qiymatlar saqlanadi, forma esa aynan shu qiymatlar bo'yicha
 * tanlanganini ko'rsatadi. Agar import Excel'dagi "Sayxun" matnini
 * o'zgartirmasdan yozsa, forma uni tanimaydi va Filial bo'sh ko'rinadi.
 *
 * Shuning uchun manba bitta joyda — ikkalasi ham shu yerdan oladi.
 */

export const BRANCH_OPTIONS = [
  { value: 'sayxun', label: 'Sayxun' },
  { value: "xalqlar do'stligi", label: "Xalqlar do'stligi" },
  { value: 'tuman', label: 'Tuman' },
];

export const DEPARTMENT_OPTIONS = [
  { value: 'moliya', label: 'Moliya' },
  { value: 'HR', label: 'HR' },
  { value: 'sotuv', label: 'Sotuv' },
  { value: 'kassir', label: 'Kassir' },
  { value: 'oquv', label: "O'quv" },
  { value: 'boshqaruv', label: 'Boshqaruv' },
  { value: 'texnik', label: "Texnik bo'lim" },
];

export const POSITION_OPTIONS = [
  { value: 'moliya', label: 'Moliya' },
  { value: 'HR', label: 'HR' },
  { value: 'sotuv', label: 'Sotuv' },
  { value: 'kassir', label: 'Kassir' },
  { value: 'call_operator', label: 'Call-operator' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'boshqaruv', label: 'Boshqaruv' },
  { value: 'texnik', label: "Texnik bo'lim" },
];

/**
 * Turli apostrof belgilarini (' ' ` ʻ) bittaga keltirib, kichik harfga
 * o'tkazadi. O'zbekcha matnda apostrof eng ko'p farq qiladigan belgi:
 * "O'quv", "O‘quv", "Oquv" — bir xil narsa, lekin uchta boshqa satr.
 */
function canonical(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[''`ʻʼ‘’]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Excel'dan kelgan erkin matnni ro'yxatdagi rasmiy qiymatga aylantiradi.
 * Qiymat ham, ko'rinadigan nom ham tekshiriladi ("texnik" va "Texnik
 * bo'lim" — ikkalasi ham `texnik` ga tushadi). Mos kelmasa `null`
 * qaytaradi — chaqiruvchi tomon buni foydalanuvchiga ko'rsatishi kerak,
 * jimgina noto'g'ri qiymat yozib qo'ymasligi uchun.
 */
export function matchOption(rawValue, options) {
  const needle = canonical(rawValue);
  if (!needle) return null;

  const exact = options.find(
    (o) => canonical(o.value) === needle || canonical(o.label) === needle
  );
  if (exact) return exact.value;

  // "Texnik bo'lim" ↔ "texnik" kabi qisman mosliklar
  const partial = options.find((o) => {
    const v = canonical(o.value);
    const l = canonical(o.label);
    return needle.startsWith(v) || v.startsWith(needle) || needle.startsWith(l) || l.startsWith(needle);
  });
  return partial ? partial.value : null;
}

/** Qiymatga mos ko'rinadigan nomni qaytaradi (jadval/ro'yxatlarda ishlatish uchun). */
export function optionLabel(value, options) {
  const found = options.find((o) => canonical(o.value) === canonical(value));
  return found ? found.label : value;
}
