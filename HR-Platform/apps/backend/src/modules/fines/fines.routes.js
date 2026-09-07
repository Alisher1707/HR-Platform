import express from 'express';
import Joi from 'joi';
import * as finesController from './fines.controller.js';
import { authenticate, authorize } from '../auth/auth.middleware.js';
import { validate, validateQuery, validateParams, commonSchemas } from '../../shared/middleware/validate.js';
import { uploadFineFile, handleMulterError } from '../../shared/middleware/upload.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

const createFineTypeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
});

const templateSchema = Joi.object({
  violationType: Joi.string().valid('kech_kelish', 'erta_ketish', 'chiqish_yoq', 'kelmagan_kun').required(),
  timeLimit: Joi.string().max(5).allow('', null),
  // XAVFSIZLIK-AUDIT.md (6-pass, F5): DB ustuni numeric(12,2) — chegarasiz
  // Joi bilan undan katta qiymat Postgresga tushib, tushunarsiz xom xato
  // (500) sifatida chiqib ketardi (jonli sinovda tasdiqlandi). Endi Joi
  // o'zi aniq, foydalanuvchiga tushunarli xato bilan rad etadi.
  amount: Joi.number().min(0).max(9999999999.99).default(0).messages({ 'number.max': "Summa juda katta (DB chegarasi: 9 999 999 999.99)" }),
  fineTypeId: Joi.string().uuid().allow('', null),
});

const VIOLATION_LABELS = {
  kech_kelish: 'Kech kelish',
  erta_ketish: 'Erta ketish',
  chiqish_yoq: 'Chiqish belgilanmagan',
  kelmagan_kun: 'Kelmagan kun',
};

// Faqat shu ikkisida "necha daqiqa" degan tushuncha bor, ya'ni faqat
// ular bosqichlarga bo'linishi mumkin. Qolgan ikkitasi kun tugagandan
// keyin baholanadi va vaqt chegarasini umuman ishlatmaydi.
const TIME_BASED_VIOLATIONS = new Set(['kech_kelish', 'erta_ketish']);

/**
 * BIR XIL TUR + BIR XIL VAQT CHEGARASI = QO'SH YOZUV.
 *
 * Jarima shablonlari bosqichli ishlaydi (autoFineService.js#pickApplicableTemplate):
 * bitta qoidabuzarlik uchun unga mos keladiganlardan ENG QIMMATI qo'llanadi.
 * Ya'ni bular to'g'ri va foydali:
 *
 *     Kech kelish, 5 daqiqadan ortiq  -> 10 000
 *     Kech kelish, 10 daqiqadan ortiq -> 30 000
 *
 * Lekin bir xil turda IKKI XIL summa bilan BIR XIL chegara qo'yilsa, ikkalasi
 * bir xil shartga mos keladi va biri ikkinchisini jimgina "yeb qo'yadi" —
 * HR ro'yxatda ikkala qatorni ko'rib turadi, lekin ulardan biri hech qachon
 * ishlamaydi. Bu har doim xato, shuning uchun saqlashga yo'l qo'yilmaydi.
 *
 * Tarixi: 2026-09-07 gacha bosqich mantiqi umuman yo'q edi — mos keluvchi
 * HAR BIR shablon uchun alohida jarima yozilardi, ya'ni 11 daqiqalik bitta
 * kechikish uchun xodim 10 000 VA 30 000 so'm olardi (Telegram'ga ikkita
 * xabar). Runtime tuzatildi; bu tekshiruv esa noaniq sozlamaning o'zini
 * manbada to'xtatadi.
 */
function validateTemplateBrackets(value, helpers) {
  const seen = new Map();

  for (const tpl of value) {
    const label = VIOLATION_LABELS[tpl.violationType] || tpl.violationType;

    if (TIME_BASED_VIOLATIONS.has(tpl.violationType)) {
      // Vaqtga bog'liq turlar — bosqich qilish MUMKIN, faqat chegaralar
      // farqli bo'lishi shart.
      const limit = tpl.timeLimit || '';
      const key = `${tpl.violationType}|${limit}`;
      if (seen.has(key)) {
        return helpers.message(
          `"${label}" turi uchun ${limit || 'chegarasiz'} bir xil vaqt chegarasi bilan ikkita shablon bor. ` +
          `Bitta qoidabuzarlikka bitta jarima yoziladi, shuning uchun ulardan biri hech qachon ishlamaydi. ` +
          `Chegaralarni farqli qiling (masalan 00:05 va 00:10) yoki ortiqchasini o'chiring.`
        );
      }
      seen.set(key, true);
    } else {
      // "Kelmagan kun" va "Chiqish belgilanmagan" — bu holatlarda vaqt
      // chegarasi ish vaqtida UMUMAN hisobga olinmaydi (kun tugagach
      // baholanadi, "necha daqiqa" degan tushuncha yo'q — qarang:
      // autoFineService.js#processDailyAutoFines, u pickApplicableTemplate'ga
      // minutesOver=null uzatadi). Shuning uchun bu turda ikkita shablon
      // qo'yilsa, chegaralari boshqa bo'lsa ham, faqat kattaroq summalisi
      // ishlaydi — ikkinchisi jimgina o'lik qoladi.
      const key = tpl.violationType;
      if (seen.has(key)) {
        return helpers.message(
          `"${label}" turi uchun ikkita shablon bor. Bu turda vaqt chegarasi hisobga olinmaydi ` +
          `(kun tugagach baholanadi), shuning uchun ulardan faqat bittasi ishlaydi. ` +
          `Bitta shablon qoldiring.`
        );
      }
      seen.set(key, true);
    }
  }

  return value;
}

const policySchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  enabled: Joi.boolean().default(true),
  templates: Joi.array().items(templateSchema).default([]).custom(validateTemplateBrackets),
  employeeIds: Joi.array().items(commonSchemas.uuid).default([]),
});

const listAssignedFinesQuerySchema = Joi.object({
  employeeId: Joi.string().uuid().allow('').optional(),
  branches: Joi.string().allow('').optional(),
  departments: Joi.string().allow('').optional(),
  positions: Joi.string().allow('').optional(),
  scheduleIds: Joi.string().allow('').optional(),
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').optional(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('').optional(),
});

const createAssignedFineSchema = Joi.object({
  employeeId: commonSchemas.uuid,
  amount: Joi.number().positive().max(9999999999.99).required().messages({ 'number.max': "Summa juda katta (DB chegarasi: 9 999 999 999.99)" }),
  fineTypeId: Joi.string().uuid().allow('', null),
  note: Joi.string().max(500).allow('', null),
});

const punishmentStatusSchema = Joi.object({
  status: Joi.string().valid('bajarildi', 'bajarilmadi').required(),
  note: Joi.string().trim().min(1).max(1000).required(),
});

const listAppealsQuerySchema = Joi.object({
  status: Joi.string().valid('kutilmoqda', 'tasdiqlandi', 'rad_etildi').optional(),
});

const reviewAppealSchema = Joi.object({
  status: Joi.string().valid('tasdiqlandi', 'rad_etildi').required(),
  note: Joi.string().trim().max(1000).allow('', null),
});

const uuidParamSchema = Joi.object({ id: commonSchemas.uuid });
const canManage = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

// "Jazo turi" katalogi
router.get('/types', authenticate, canManage, finesController.getFineTypes);
router.post('/types', authenticate, canManage, validate(createFineTypeSchema), finesController.createFineType);
router.delete(
  '/types/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  finesController.deleteFineType
);

// "Jarima" siyosatlari
router.get('/policies', authenticate, canManage, finesController.getFinePolicies);

// Bir nechta siyosatga tushgan xodimlar — interfeys buni ko'rsata olmasdi
// (tahrir oynasi faqat bitta siyosatni biladi), shuning uchun alohida.
router.get('/policy-overlaps', authenticate, canManage, finesController.getPolicyOverlaps);
router.get('/policies/:id', authenticate, canManage, validateParams(uuidParamSchema), finesController.getFinePolicyById);
router.post('/policies', authenticate, canManage, validate(policySchema), finesController.createFinePolicy);
router.put(
  '/policies/:id',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(policySchema),
  finesController.updateFinePolicy
);
router.delete(
  '/policies/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  finesController.deleteFinePolicy
);

// Xodimga tayinlangan (haqiqatan tortilgan) jarimalar
router.get('/assigned', authenticate, canManage, validateQuery(listAssignedFinesQuerySchema), finesController.getAssignedFines);
router.post(
  '/assigned',
  authenticate,
  canManage,
  uploadFineFile,
  handleMulterError,
  validate(createAssignedFineSchema),
  finesController.createAssignedFine
);
router.patch(
  '/assigned/:id/punishment',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(punishmentStatusSchema),
  finesController.updatePunishmentStatus
);
router.delete(
  '/assigned/:id',
  authenticate,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validateParams(uuidParamSchema),
  finesController.deleteAssignedFine
);

// Xodim Telegram bot orqali yuborgan tushuntirish xatlari (apellatsiya)
router.get('/appeals', authenticate, canManage, validateQuery(listAppealsQuerySchema), finesController.getFineAppeals);
router.patch(
  '/appeals/:id/review',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  validate(reviewAppealSchema),
  finesController.reviewFineAppeal
);
router.post(
  '/appeals/:id/forward-to-manager',
  authenticate,
  canManage,
  validateParams(uuidParamSchema),
  finesController.forwardAppealToManager
);

export default router;
