import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  SkipForward,
  Loader2,
  Table2,
  ListChecks,
  Sparkles,
  RotateCcw,
  Info,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import {
  BRANCH_OPTIONS,
  DEPARTMENT_OPTIONS,
  POSITION_OPTIONS,
  matchOption,
} from '../../constants/employeeOptions';
import './EmployeeImportWizard.css';

/**
 * Excel'dan xodimlarni ommaviy import qilish ustasi.
 *
 * To'rt bosqich: fayl yuklash → ustunlarni moslashtirish → tekshirish →
 * natija. Fayl BRAUZERDA o'qiladi (xlsx dinamik import qilinadi, shunda u
 * asosiy bundle'ga tushmaydi) va serverga tayyor JSON bo'lib boradi —
 * backend fayl formatlarini umuman bilmaydi.
 */

/**
 * Import qilinadigan maydonlar. `aliases` — ustun sarlavhasini avtomatik
 * tanib olish uchun: HR har xil fayl ishlatadi ("Ism", "Ismi", "First Name",
 * "Имя"), shuning uchun moslashtirish qo'lda qilinishi shart bo'lmasin.
 */
const FIELDS = [
  { key: 'firstName', label: 'Ism', required: true, aliases: ['ism', 'ismi', 'firstname', 'first name', 'имя'] },
  { key: 'lastName', label: 'Familiya', required: true, aliases: ['familiya', 'familiyasi', 'lastname', 'last name', 'фамилия'] },
  { key: 'employeeNumber', label: 'Tabel raqami', aliases: ['tabel', 'tabel raqami', 'employee number', 'табель'] },
  // `options` bo'lgan maydonlar erkin matn emas — xodim kartochkasida
  // ro'yxatdan tanlanadi, shuning uchun import ham aynan o'sha rasmiy
  // qiymatga keltirishi shart, aks holda forma qiymatni tanimaydi.
  { key: 'position', label: 'Lavozim', options: POSITION_OPTIONS, aliases: ['lavozim', 'lavozimi', 'position', 'должность'] },
  { key: 'department', label: "Bo'lim", options: DEPARTMENT_OPTIONS, aliases: ['bolim', "bo'lim", 'bolimi', 'department', 'отдел'] },
  { key: 'branch', label: 'Filial', options: BRANCH_OPTIONS, aliases: ['filial', 'filiali', 'branch', 'филиал'] },
  { key: 'phone', label: 'Telefon', aliases: ['telefon', 'tel', 'phone', 'телефон', 'raqam'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'pochta', 'почта'] },
  { key: 'pnfl', label: 'JSHSHIR', hint: '14 raqam', aliases: ['jshshir', 'pnfl', 'jshshr', 'пинфл'] },
  { key: 'birthDate', label: "Tug'ilgan sana", type: 'date', aliases: ['tugilgan', "tug'ilgan sana", 'birthdate', 'birth date', 'дата рождения'] },
  { key: 'joinDate', label: 'Ishga kirgan sana', type: 'date', aliases: ['ishga kirgan', 'joindate', 'join date', 'qabul', 'дата приема'] },
  { key: 'salaryAmount', label: 'Ish haqi', type: 'number', aliases: ['ish haqi', 'oylik', 'maosh', 'salary', 'зарплата'] },
  { key: 'salaryType', label: 'Ish haqi turi', aliases: ['ish haqi turi', 'salary type', 'tolov turi'] },
  { key: 'experience', label: 'Tajriba (yil)', type: 'number', aliases: ['tajriba', 'experience', 'стаж'] },
  { key: 'telegramUsername', label: 'Telegram', aliases: ['telegram', 'tg'] },
  { key: 'address', label: 'Manzil', aliases: ['manzil', 'address', 'адрес'] },
  { key: 'contractStartDate', label: 'Shartnoma boshlanishi', type: 'date', aliases: ['shartnoma boshlanishi', 'contract start'] },
  { key: 'contractEndDate', label: 'Shartnoma tugashi', type: 'date', aliases: ['shartnoma tugashi', 'contract end'] },
];

const REQUIRED_KEYS = FIELDS.filter((f) => f.required).map((f) => f.key);

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/[_\-.]/g, ' ').replace(/\s+/g, ' ');
}

/** Ustun sarlavhasiga qarab maydonni topadi — avval aniq moslik, keyin qisman. */
function guessField(header, alreadyUsed) {
  const norm = normalizeHeader(header);
  if (!norm) return '';
  for (const field of FIELDS) {
    if (alreadyUsed.has(field.key)) continue;
    if (field.aliases.some((a) => a === norm)) return field.key;
  }
  for (const field of FIELDS) {
    if (alreadyUsed.has(field.key)) continue;
    if (field.aliases.some((a) => norm.includes(a) || a.includes(norm))) return field.key;
  }
  return '';
}

/**
 * Haqiqiy HR fayllarida birinchi qator ko'pincha sarlavha ("XODIMLAR
 * MA'LUMOTLARI REESTRI") yoki bo'sh ajratuvchi bo'ladi — ustun nomlari esa
 * 2- yoki 3-qatorda. Birinchi qatorni har doim sarlavha deb hisoblash bunday
 * fayllarda hamma narsani buzadi: haqiqiy ustun nomlari ("Ism", "Familiya")
 * ma'lumot sifatida o'qilib qoladi, ular esa hech qanday maydonga mos
 * kelmaydi.
 *
 * Shuning uchun birinchi 10 qatorni sinab ko'ramiz — har birida nechta
 * katak bizning maydon nomlarimizga mos kelishini sanaymiz. Eng ko'p mos
 * kelgan qator haqiqiy sarlavha deb olinadi. Hech qaysi qatorda mos
 * kelmasa (ustun nomlari fayl tilida umuman boshqacha), xavfsiz holatga —
 * birinchi qatorga — qaytiladi.
 */
function findHeaderRowIndex(matrix) {
  const candidateCount = Math.min(10, matrix.length);
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < candidateCount; i += 1) {
    const row = matrix[i];
    const nonEmpty = row.filter((c) => String(c ?? '').trim() !== '').length;
    if (nonEmpty < 2) continue; // yagona katakli sarlavha qatori bo'lolmaydi

    const used = new Set();
    let matches = 0;
    row.forEach((cell) => {
      const guess = guessField(cell, used);
      if (guess) {
        matches += 1;
        used.add(guess);
      }
    });

    // Tenglik holida: ko'proq mos kelgan, so'ng ko'proq to'lgan, so'ng
    // fayldagi birinchi qator g'olib chiqadi.
    if (matches > bestScore || (matches === bestScore && nonEmpty > (matrix[bestIndex]?.filter((c) => String(c ?? '').trim() !== '').length || 0))) {
      bestScore = matches;
      bestIndex = i;
    }
  }

  return bestScore > 0 ? bestIndex : 0;
}

/**
 * Excel sanasi uch xil ko'rinishda kelishi mumkin: haqiqiy Date (xlsx
 * cellDates bilan), matn ("15.03.2024") yoki Excel'ning ichki seriya raqami.
 * Uchalasini ham ISO (YYYY-MM-DD) ga keltiramiz — backend Joi shuni kutadi.
 */
function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Excel seriya raqami — 1899-12-30 dan boshlanadigan kunlar soni.
  if (typeof value === 'number' && value > 0 && value < 100000) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const dotted = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dotted) {
    const [, d, m, y] = dotted;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  return null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Bo'sh qiymatni null qiladi va matnni tozalaydi. */
function toText(value) {
  if (value === null || value === undefined) return null;
  const t = String(value).trim();
  return t === '' ? null : t;
}

export function EmployeeImportWizard({ isOpen, onClose, onImported }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({}); // { columnIndex: fieldKey }
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const reset = useCallback(() => {
    setStep(1);
    setFileName('');
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setResult(null);
    setParseError('');
    setProgress({ done: 0, total: 0 });
    setIsDragging(false);
  }, []);

  const handleClose = useCallback(() => {
    // Import yakunlangan bo'lsa ro'yxatni yangilash kerak — foydalanuvchi
    // modalni yopgach yangi xodimlarni darhol ko'rsin.
    if (result && result.imported > 0 && onImported) onImported();
    reset();
    onClose();
  }, [result, onImported, reset, onClose]);

  const parseFile = useCallback(async (file) => {
    setParseError('');
    setIsParsing(true);
    try {
      // Dinamik import — xlsx ~150KB, faqat import ishlatilganda yuklansin.
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("Faylda birorta ham varaq topilmadi");

      // blankrows YO'Q — bo'sh qatorlarni bu bosqichda olib tashlamaymiz,
      // chunki quyidagi '!merges' birlashtirilgan katakchalar RAW sheet
      // qator raqamlariga (bo'sh qatorlar ham hisobga olingan holda)
      // ishora qiladi. Agar bo'sh qatorlarni oldindan filtrlasak, matritsa
      // indekslari sheet'dagi haqiqiy qator raqamlaridan siljib ketadi va
      // merge to'ldirish butunlay noto'g'ri katakchalarga tushadi.
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (matrix.length < 2) throw new Error('Faylda sarlavha qatoridan boshqa maʼlumot yoʻq');

      // Birlashtirilgan katakchalar (merged cells): Excel'da qiymat butun
      // birlashgan hudud bo'ylab ko'rinadi, lekin xom ma'lumotda faqat
      // yuqori chap katakda saqlanadi — qolganlari bo'sh. Foydalanuvchiga
      // "hammasi to'ldirilgan" ko'rinadi, dastur esa ularni bo'sh deb o'qib,
      // Ism/Familiya kabi majburiy maydonlarni xato deb belgilaydi. Har bir
      // birlashgan hudud qiymatini o'sha hududning barcha katakchalariga
      // qo'lda tarqatib chiqamiz.
      (sheet['!merges'] || []).forEach((range) => {
        const topValue = matrix[range.s.r]?.[range.s.c];
        if (topValue === undefined || String(topValue).trim() === '') return;
        for (let r = range.s.r; r <= range.e.r; r += 1) {
          if (!matrix[r]) continue;
          for (let c = range.s.c; c <= range.e.c; c += 1) {
            if (String(matrix[r][c] ?? '').trim() === '') matrix[r][c] = topValue;
          }
        }
      });

      // Sarlavha qatori har doim ham birinchi qator emas — sarlavha
      // matni yoki bo'sh ajratuvchi qator oldida kelishi mumkin.
      const headerRowIndex = findHeaderRowIndex(matrix);
      const headerRow = matrix[headerRowIndex].map((h) => String(h ?? '').trim());

      // Har bir qatorga o'zining HAQIQIY Excel qator raqamini biriktiramiz
      // (1-indeksli, xuddi Excel'ning o'zida ko'rinadigani kabi) — shunda
      // fayldagi bo'sh qatorlar tashlab yuborilsa ham, xato xabarlari
      // ("5-qator noto'g'ri") HR Excel'da ochganda ko'radigan qatorga
      // aniq mos keladi, oddiy ketma-ket sanashdan farqli o'laroq.
      const dataRows = matrix
        .slice(headerRowIndex + 1)
        .map((cells, i) => ({ cells, excelRowNumber: headerRowIndex + 1 + i + 1 }))
        .filter(({ cells }) => cells.some((c) => String(c ?? '').trim() !== ''));
      if (dataRows.length === 0) throw new Error('Faylda toʻldirilgan qator topilmadi');

      // Avtomatik moslashtirish
      const used = new Set();
      const autoMap = {};
      headerRow.forEach((h, idx) => {
        const guess = guessField(h, used);
        if (guess) {
          autoMap[idx] = guess;
          used.add(guess);
        }
      });

      setFileName(file.name);
      setHeaders(headerRow);
      setRawRows(dataRows);
      setMapping(autoMap);
      setStep(2);
    } catch (err) {
      setParseError(err.message || 'Faylni oʻqib boʻlmadi. .xlsx yoki .csv formatida ekanini tekshiring.');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const headerRow = FIELDS.map((f) => f.label);
    // Namunadagi Lavozim/Bo'lim/Filial ataylab rasmiy ro'yxatdan olinadi —
    // shunda HR qanday yozish kerakligini darhol ko'radi.
    const example = [
      'Alisher', 'Abdusalomov', '1042',
      POSITION_OPTIONS.find((o) => o.value === 'mentor').label,
      DEPARTMENT_OPTIONS.find((o) => o.value === 'oquv').label,
      BRANCH_OPTIONS.find((o) => o.value === 'sayxun').label,
      '+998901234567', 'alisher@company.uz', '31234567890123', '15.03.1998', '01.02.2024',
      '8000000', 'Oylik', '3', '@alisher', 'Toshkent sh.', '01.02.2024', '01.02.2027',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headerRow, example]);
    ws['!cols'] = headerRow.map(() => ({ wch: 20 }));

    // Ikkinchi varaq — ruxsat etilgan qiymatlar ro'yxati. Filial/Bo'lim/
    // Lavozim erkin matn emas, shuning uchun HR faylni to'ldirayotganda
    // qaysi so'zlar qabul qilinishini ko'rib turishi kerak.
    const maxLen = Math.max(BRANCH_OPTIONS.length, DEPARTMENT_OPTIONS.length, POSITION_OPTIONS.length);
    const refRows = [['Filial', "Bo'lim", 'Lavozim']];
    for (let i = 0; i < maxLen; i += 1) {
      refRows.push([
        BRANCH_OPTIONS[i]?.label || '',
        DEPARTMENT_OPTIONS[i]?.label || '',
        POSITION_OPTIONS[i]?.label || '',
      ]);
    }
    const refWs = XLSX.utils.aoa_to_sheet(refRows);
    refWs['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Xodimlar');
    XLSX.utils.book_append_sheet(wb, refWs, "Ruxsat etilgan qiymatlar");
    XLSX.writeFile(wb, 'xodimlar-namuna.xlsx');
  };

  /** Moslashtirilgan ustunlar asosida qatorlarni tayyor obyektga aylantiradi. */
  const preparedRows = useMemo(() => {
    if (step < 3 && step !== 2) return [];
    const fieldByColumn = Object.entries(mapping).filter(([, v]) => v);

    return rawRows.map(({ cells, excelRowNumber }) => {
      const obj = { rowNumber: excelRowNumber };
      // Ro'yxatdan tanlanadigan maydonlarda mos kelmagan qiymatlar —
      // bular xato emas (import to'xtamaydi), lekin foydalanuvchi ularni
      // ko'rishi kerak, chunki bunday xodimda Filial/Bo'lim bo'sh qoladi.
      const unmatched = [];

      fieldByColumn.forEach(([colIdx, fieldKey]) => {
        const field = FIELDS.find((f) => f.key === fieldKey);
        const raw = cells[Number(colIdx)];

        if (field.type === 'date') {
          obj[fieldKey] = toIsoDate(raw);
        } else if (field.type === 'number') {
          obj[fieldKey] = toNumber(raw);
        } else if (field.options) {
          const text = toText(raw);
          const matched = text ? matchOption(text, field.options) : null;
          obj[fieldKey] = matched;
          if (text && !matched) unmatched.push({ field: field.label, value: text });
        } else {
          obj[fieldKey] = toText(raw);
        }
      });

      // Ism VA Familiya ikkalasi ham bo'sh — bu xodim yozuvi emas. Haqiqiy
      // fayllarda jadval tagida "Jami" qatori bo'lishi odatiy hol: Ism/
      // Familiya ustunlari bo'sh, lekin "Oylik maosh" ustunida SUM(),
      // "Tajriba" ustunida AVERAGE() natijasi turadi — shu raqamlar
      // borligi uchun qator "butunlay bo'sh" filtridan o'tib ketadi va
      // xato sifatida ko'rsatilardi, garchi u umuman xodim bo'lmasa ham.
      // Bunday qatorni xato emas, oddiy "e'tiborga olinmadi" deb belgilaymiz.
      const isSummaryRow = REQUIRED_KEYS.length > 0 && REQUIRED_KEYS.every((k) => !obj[k]);
      if (isSummaryRow) {
        return { ...obj, __errors: [], __unmatched: [], __skippedAsSummary: true };
      }

      const errors = [];
      REQUIRED_KEYS.forEach((k) => {
        const label = FIELDS.find((f) => f.key === k).label;
        if (!obj[k]) errors.push(`${label} toʻldirilmagan`);
        else if (String(obj[k]).length < 2) errors.push(`${label} juda qisqa`);
      });
      if (obj.pnfl && !/^\d{14}$/.test(obj.pnfl)) errors.push('JSHSHIR 14 ta raqamdan iborat boʻlishi kerak');
      if (obj.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(obj.email)) errors.push('Email formati notoʻgʻri');

      return { ...obj, __errors: errors, __unmatched: unmatched, __skippedAsSummary: false };
    });
  }, [rawRows, mapping, step]);

  // Sarlavha/"Jami" kabi xodim bo'lmagan qatorlar butunlay chetlanadi —
  // ular na tayyor, na xato hisoblanadi, foydalanuvchiga umuman ko'rsatilmaydi.
  const dataOnlyRows = useMemo(() => preparedRows.filter((r) => !r.__skippedAsSummary), [preparedRows]);

  const validRows = useMemo(() => dataOnlyRows.filter((r) => r.__errors.length === 0), [dataOnlyRows]);
  const invalidRows = useMemo(() => preparedRows.filter((r) => r.__errors.length > 0), [preparedRows]);
  const summaryRowCount = useMemo(() => preparedRows.filter((r) => r.__skippedAsSummary).length, [preparedRows]);

  /**
   * Ro'yxatga tushmagan Filial/Bo'lim/Lavozim qiymatlari — noyob qilib
   * yig'iladi ("Dasturlash bo'limi" 50 ta qatorda bo'lsa ham bir marta
   * ko'rsatiladi). Bu xato emas: xodim baribir import qilinadi, lekin
   * o'sha maydoni bo'sh bo'ladi va HR uni keyin tanlashi kerak.
   */
  const unmatchedValues = useMemo(() => {
    const seen = new Map();
    validRows.forEach((r) => {
      (r.__unmatched || []).forEach(({ field, value }) => {
        const key = `${field}::${value}`;
        seen.set(key, { field, value, count: (seen.get(key)?.count || 0) + 1 });
      });
    });
    return [...seen.values()].sort((a, b) => b.count - a.count);
  }, [validRows]);

  /**
   * Natija ekranidagi "muammoli qatorlar" jadvali ikkita manbani birlashtiradi:
   * brauzerda tekshiruvdan o'tmagan qatorlar (ular serverga umuman
   * yuborilmagan) va server rad etgan/o'tkazib yuborgan qatorlar. Faqat
   * server javobini ko'rsatilganda jadval sarlavhasi chiqib, ichi bo'sh
   * qolardi — foydalanuvchi "2 ta xatolik" sonini ko'rib, ularning
   * qaysi qator ekanini bilolmasdi.
   */
  const problemRows = useMemo(() => {
    const fromClient = invalidRows.map((r) => ({
      rowNumber: r.rowNumber,
      name: [r.firstName, r.lastName].filter(Boolean).join(' ') || '—',
      status: 'failed',
      message: r.__errors.join('; '),
    }));
    const fromServer = (result?.results || []).filter((r) => r.status !== 'imported');
    return [...fromClient, ...fromServer].sort((a, b) => a.rowNumber - b.rowNumber);
  }, [invalidRows, result]);

  const mappedFieldKeys = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const missingRequired = REQUIRED_KEYS.filter((k) => !mappedFieldKeys.has(k));

  const handleMappingChange = (colIdx, fieldKey) => {
    setMapping((prev) => {
      const next = { ...prev };
      // Bitta maydon faqat bitta ustunga bog'lanadi — boshqasidan olib tashlaymiz.
      if (fieldKey) {
        Object.keys(next).forEach((k) => {
          if (next[k] === fieldKey) delete next[k];
        });
        next[colIdx] = fieldKey;
      } else {
        delete next[colIdx];
      }
      return next;
    });
  };

  const runImport = async () => {
    setIsImporting(true);
    setProgress({ done: 0, total: validRows.length });
    try {
      const payload = validRows.map(({ __errors, ...rest }) => rest);
      const { default: employeeService } = await import('../../services/employeeService');
      const res = await employeeService.bulkImport(payload, (done, total) => setProgress({ done, total }));
      setResult(res);
      setStep(4);
    } catch (err) {
      setParseError(err.response?.data?.message || 'Import vaqtida xatolik yuz berdi');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrorReport = async () => {
    const XLSX = await import('xlsx');
    const rows = problemRows.map((r) => ({
      Qator: r.rowNumber,
      Xodim: r.name,
      Holat: r.status === 'skipped' ? "O'tkazib yuborildi" : 'Xatolik',
      Sababi: r.message,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 20 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Xatoliklar');
    XLSX.writeFile(wb, 'import-xatoliklari.xlsx');
  };

  const STEPS = [
    { n: 1, label: 'Fayl', icon: UploadCloud },
    { n: 2, label: 'Ustunlar', icon: Table2 },
    { n: 3, label: 'Tekshirish', icon: ListChecks },
    { n: 4, label: 'Natija', icon: CheckCircle2 },
  ];

  const footer = (
    <div className="imp-footer">
      <div className="imp-footer-left">
        {step === 2 && (
          <Button variant="outline" onClick={() => { reset(); }} icon={<ArrowLeft size={15} strokeWidth={2.25} />}>
            Boshqa fayl
          </Button>
        )}
        {step === 3 && (
          <Button variant="outline" onClick={() => setStep(2)} icon={<ArrowLeft size={15} strokeWidth={2.25} />}>
            Ustunlarga qaytish
          </Button>
        )}
      </div>
      <div className="imp-footer-right">
        {step === 2 && (
          <Button
            variant="primary"
            onClick={() => setStep(3)}
            disabled={missingRequired.length > 0}
            icon={<ArrowRight size={15} strokeWidth={2.25} />}
          >
            Tekshirishga oʻtish
          </Button>
        )}
        {step === 3 && (
          <Button
            variant="primary"
            onClick={runImport}
            disabled={validRows.length === 0 || isImporting}
            icon={isImporting
              ? <Loader2 size={15} strokeWidth={2.25} className="imp-spin" />
              : <UploadCloud size={15} strokeWidth={2.25} />}
          >
            {isImporting
              ? `Yuklanmoqda… ${progress.done}/${progress.total}`
              : `${validRows.length} ta xodimni import qilish`}
          </Button>
        )}
        {step === 4 && (
          <Button variant="primary" onClick={handleClose} icon={<CheckCircle2 size={15} strokeWidth={2.25} />}>
            Yakunlash
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Excel'dan xodimlarni import qilish"
      size="xl"
      align="top"
      footer={step > 1 ? footer : null}
    >
      {/* ---- Bosqichlar chizig'i ---- */}
      <div className="imp-steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = step > s.n ? 'done' : step === s.n ? 'active' : 'idle';
          return (
            <React.Fragment key={s.n}>
              <div className={`imp-step ${state}`}>
                <span className="imp-step-dot">
                  {state === 'done'
                    ? <CheckCircle2 size={16} strokeWidth={2.5} />
                    : <Icon size={15} strokeWidth={2.25} />}
                </span>
                <span className="imp-step-label">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <span className={`imp-step-line ${step > s.n ? 'done' : ''}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ---- 1: FAYL ---- */}
      {step === 1 && (
        <div className="imp-pane">
          <div
            className={`imp-drop ${isDragging ? 'dragging' : ''} ${isParsing ? 'busy' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isParsing && fileInputRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isParsing) fileInputRef.current?.click(); }}
            role="button"
            tabIndex={0}
          >
            <span className="imp-drop-icon">
              {isParsing
                ? <Loader2 size={30} strokeWidth={1.75} className="imp-spin" />
                : <UploadCloud size={30} strokeWidth={1.75} />}
            </span>
            <p className="imp-drop-title">
              {isParsing ? 'Fayl oʻqilmoqda…' : 'Faylni shu yerga tashlang'}
            </p>
            <p className="imp-drop-sub">
              yoki <span className="imp-link">tanlash uchun bosing</span> — .xlsx, .xls, .csv
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              hidden
            />
          </div>

          {parseError && (
            <div className="imp-alert error">
              <XCircle size={17} strokeWidth={2.25} />
              <span>{parseError}</span>
            </div>
          )}

          <div className="imp-tip">
            <span className="imp-tip-icon"><Sparkles size={16} strokeWidth={2} /></span>
            <div>
              <strong>Fayl qanday boʻlishi kerak?</strong>
              <p>
                Birinchi qator — ustun nomlari, keyingilari — xodimlar. Ustunlar tartibi
                muhim emas: tizim nomlariga qarab oʻzi topadi. Faqat <b>Ism</b> va{' '}
                <b>Familiya</b> majburiy.
              </p>
              <p>
                Allaqachon mavjud xodimlar qayta qoʻshilmaydi — tizim ularni{' '}
                <b>JSHSHIR</b> boʻyicha, u boʻsh boʻlsa <b>telefon raqami</b> boʻyicha taniydi.
                Shuning uchun faylni tuzatib qayta yuklasangiz, ikkinchi nusxa paydo boʻlmaydi.
              </p>
              <button type="button" className="imp-template-btn" onClick={downloadTemplate}>
                <Download size={14} strokeWidth={2.25} />
                Namuna faylni yuklab olish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- 2: USTUNLARNI MOSLASHTIRISH ---- */}
      {step === 2 && (
        <div className="imp-pane">
          <div className="imp-filebar">
            <span className="imp-filebar-icon"><FileSpreadsheet size={17} strokeWidth={2} /></span>
            <div className="imp-filebar-text">
              <strong>{fileName}</strong>
              <span>{rawRows.length} ta qator · {headers.length} ta ustun</span>
            </div>
            <span className="imp-badge auto">
              <Sparkles size={13} strokeWidth={2.25} />
              {mappedFieldKeys.size} ta ustun avtomatik topildi
            </span>
          </div>

          {missingRequired.length > 0 && (
            <div className="imp-alert warn">
              <AlertTriangle size={17} strokeWidth={2.25} />
              <span>
                Majburiy maydon moslashtirilmagan:{' '}
                <b>{missingRequired.map((k) => FIELDS.find((f) => f.key === k).label).join(', ')}</b>
              </span>
            </div>
          )}

          <div className="imp-map-list">
            {headers.map((h, idx) => {
              const selected = mapping[idx] || '';
              const field = FIELDS.find((f) => f.key === selected);
              const sample = rawRows.slice(0, 2)
                .map(({ cells }) => String(cells[idx] ?? '').trim())
                .filter(Boolean)
                .join(' · ');

              return (
                <div key={idx} className={`imp-map-row ${selected ? 'mapped' : ''}`}>
                  <div className="imp-map-source">
                    <span className="imp-map-col">{h || <em>(nomsiz ustun)</em>}</span>
                    {sample && <span className="imp-map-sample">{sample}</span>}
                  </div>
                  <span className="imp-map-arrow"><ArrowRight size={15} strokeWidth={2.25} /></span>
                  <select
                    className="form-select imp-map-select"
                    value={selected}
                    onChange={(e) => handleMappingChange(idx, e.target.value)}
                    aria-label={`${h} ustuni uchun maydon`}
                  >
                    <option value="">— import qilinmasin —</option>
                    {FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}{f.required ? ' *' : ''}{f.hint ? ` (${f.hint})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- 3: TEKSHIRISH ---- */}
      {step === 3 && (
        <div className="imp-pane">
          <div className="imp-summary">
            <div className="imp-sum-card ok">
              <span className="imp-sum-n">{validRows.length}</span>
              <span className="imp-sum-l">Import qilishga tayyor</span>
            </div>
            <div className={`imp-sum-card ${invalidRows.length > 0 ? 'bad' : 'muted'}`}>
              <span className="imp-sum-n">{invalidRows.length}</span>
              <span className="imp-sum-l">Xatolik bor — oʻtkazib yuboriladi</span>
            </div>
          </div>

          {summaryRowCount > 0 && (
            <div className="imp-alert info">
              <Info size={17} strokeWidth={2.25} />
              <span>
                Faylda xodim yozuvi boʻlmagan <b>{summaryRowCount} ta qator</b> (masalan "Jami"
                qatori yoki sarlavha) avtomatik eʼtiborga olinmadi — ular xatolik sifatida
                koʻrsatilmaydi.
              </span>
            </div>
          )}

          {unmatchedValues.length > 0 && (
            <div className="imp-alert info">
              <Info size={17} strokeWidth={2.25} />
              <div>
                <b>Quyidagi qiymatlar roʻyxatda topilmadi</b> — bu xodimlar baribir
                import qilinadi, lekin oʻsha maydoni boʻsh qoladi va uni keyin xodim
                kartochkasida tanlash kerak boʻladi:
                <div className="imp-unmatched">
                  {unmatchedValues.slice(0, 8).map((u) => (
                    <span key={`${u.field}-${u.value}`} className="imp-unmatched-chip">
                      {u.field}: <b>{u.value}</b>
                      {u.count > 1 && <em> ×{u.count}</em>}
                    </span>
                  ))}
                  {unmatchedValues.length > 8 && (
                    <span className="imp-unmatched-chip">…va yana {unmatchedValues.length - 8} ta</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {invalidRows.length > 0 && (
            <>
              <div className="imp-alert warn">
                <AlertTriangle size={17} strokeWidth={2.25} />
                <span>
                  Quyidagi qatorlar import qilinmaydi. Ularni faylda tuzatib, keyin qayta yuklashingiz mumkin —
                  toʻgʻri qatorlar hozir import qilinaveradi.
                </span>
              </div>
              <div className="imp-table-wrap">
                <table className="imp-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Qator</th>
                      <th>Xodim</th>
                      <th>Xatolik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invalidRows.slice(0, 50).map((r) => (
                      <tr key={r.rowNumber}>
                        <td className="imp-num">{r.rowNumber}</td>
                        <td>{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</td>
                        <td className="imp-err-text">{r.__errors.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {invalidRows.length > 50 && (
                  <p className="imp-more">…va yana {invalidRows.length - 50} ta qator</p>
                )}
              </div>
            </>
          )}

          {validRows.length > 0 && (
            <>
              <p className="imp-preview-title">Import qilinadigan maʼlumot (dastlabki 5 ta):</p>
              <div className="imp-table-wrap">
                <table className="imp-table">
                  <thead>
                    <tr>
                      {[...mappedFieldKeys].map((k) => (
                        <th key={k}>{FIELDS.find((f) => f.key === k).label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 5).map((r) => (
                      <tr key={r.rowNumber}>
                        {[...mappedFieldKeys].map((k) => (
                          <td key={k}>{r[k] ?? <span className="imp-empty">—</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {parseError && (
            <div className="imp-alert error">
              <XCircle size={17} strokeWidth={2.25} />
              <span>{parseError}</span>
            </div>
          )}
        </div>
      )}

      {/* ---- 4: NATIJA ---- */}
      {step === 4 && result && (
        <div className="imp-pane">
          <div className="imp-result-hero">
            <span className={`imp-result-icon ${result.failed > 0 ? 'partial' : 'ok'}`}>
              {result.failed > 0
                ? <AlertTriangle size={30} strokeWidth={1.75} />
                : <CheckCircle2 size={30} strokeWidth={1.75} />}
            </span>
            <h4>
              {result.failed > 0
                ? 'Import qisman yakunlandi'
                : 'Import muvaffaqiyatli yakunlandi'}
            </h4>
            <p>{result.imported} ta xodim tizimga qoʻshildi</p>
          </div>

          <div className="imp-result-stats">
            <div className="imp-rstat ok">
              <CheckCircle2 size={16} strokeWidth={2.25} />
              <span className="imp-rstat-n">{result.imported}</span>
              <span className="imp-rstat-l">Qoʻshildi</span>
            </div>
            <div className="imp-rstat skip">
              <SkipForward size={16} strokeWidth={2.25} />
              <span className="imp-rstat-n">{result.skipped}</span>
              <span className="imp-rstat-l">Allaqachon bor edi</span>
            </div>
            <div className="imp-rstat bad">
              <XCircle size={16} strokeWidth={2.25} />
              <span className="imp-rstat-n">{result.failed + invalidRows.length}</span>
              <span className="imp-rstat-l">Xatolik</span>
            </div>
          </div>

          {problemRows.length > 0 && (
            <div className="imp-table-wrap">
              <table className="imp-table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>Qator</th>
                    <th>Xodim</th>
                    <th>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {problemRows.slice(0, 50).map((r) => (
                    <tr key={`${r.rowNumber}-${r.status}`}>
                      <td className="imp-num">{r.rowNumber}</td>
                      <td>{r.name}</td>
                      <td>
                        <span className={`imp-pill ${r.status}`}>
                          {r.status === 'skipped' ? 'Oʻtkazib yuborildi' : 'Xatolik'}
                        </span>
                        <span className="imp-err-text"> {r.message}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {problemRows.length > 50 && (
                <p className="imp-more">…va yana {problemRows.length - 50} ta qator</p>
              )}
            </div>
          )}

          <div className="imp-result-actions">
            {(result.failed > 0 || invalidRows.length > 0) && (
              <button type="button" className="imp-template-btn" onClick={downloadErrorReport}>
                <Download size={14} strokeWidth={2.25} />
                Xatoliklar hisobotini yuklab olish
              </button>
            )}
            <button type="button" className="imp-template-btn" onClick={reset}>
              <RotateCcw size={14} strokeWidth={2.25} />
              Yana fayl import qilish
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default EmployeeImportWizard;
