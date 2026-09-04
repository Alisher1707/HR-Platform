import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { safeFilenameFromMime } from '../utils/safeUpload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * File Upload Middleware (Multer)
 * Handles file uploads for EJM
 */

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../../uploads/ejm');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// XAVFSIZLIK-AUDIT.md Y-6: this was the one upload route left on the old
// pattern — "allow all file types", extension taken from the client's own
// filename, served back with `inline` disposition (see ejm.controller.js).
// That combination let an ".html"/".svg" upload come back from
// /api/v1/ejm/download/<id> as a browser-executed page — stored XSS in the
// EJM module, reachable by anyone who can view an EJM node (every
// ADMIN/HR). Extension now comes ONLY from this fixed mime allow-list,
// exactly like every other upload route in this file (safeFilenameFromMime
// — see safeUpload.js).
const EJM_MIME_EXT = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'application/zip': '.zip',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: safeFilenameFromMime(EJM_MIME_EXT),
});

const fileFilter = (req, file, cb) => {
  if (EJM_MIME_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Fayl turi qo'llab-quvvatlanmaydi. Ruxsat etilgan: PDF, Word, Excel, PowerPoint, TXT, ZIP, rasm (JPG/PNG/WEBP/GIF)"));
  }
};

// Configure multer
export const uploadEJMFile = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 10 // Max 10 files at once
  }
}).array('files', 10); // Field name: 'files', max 10 files

// =============================================
// Employee photo upload (avatar)
// =============================================

const employeePhotosDir = path.join(__dirname, '../../../uploads/employees');
if (!fs.existsSync(employeePhotosDir)) {
  fs.mkdirSync(employeePhotosDir, { recursive: true });
}

// Extension is derived from the validated mimetype below — never from the
// client's own filename — so a mislabeled non-image can never end up
// served back with an executable content type. See safeUpload.js.
const IMAGE_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const employeePhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, employeePhotosDir);
  },
  filename: safeFilenameFromMime(IMAGE_MIME_EXT),
});

// Only image files are allowed for employee photos
const imageFileFilter = (req, file, cb) => {
  if (IMAGE_MIME_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Faqat rasm fayllari yuklash mumkin'));
  }
};

export const uploadEmployeePhoto = multer({
  storage: employeePhotoStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  }
}).single('photo'); // Field name: 'photo'

// =============================================
// Candidate resume upload (application form)
// =============================================

const resumesDir = path.join(__dirname, '../../../uploads/resumes');
if (!fs.existsSync(resumesDir)) {
  fs.mkdirSync(resumesDir, { recursive: true });
}

const DOCUMENT_MIME_EXT = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const resumeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, resumesDir);
  },
  filename: safeFilenameFromMime(DOCUMENT_MIME_EXT),
});

// Only document files are allowed for resumes
const resumeFileFilter = (req, file, cb) => {
  if (DOCUMENT_MIME_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Rezyume faqat PDF, DOC yoki DOCX formatida bo\'lishi kerak'));
  }
};

export const uploadResume = multer({
  storage: resumeStorage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  }
}).single('resume'); // Field name: 'resume'

// =============================================
// Onboarding task document upload ("Hujjat" turi)
// =============================================

const onboardingDocsDir = path.join(__dirname, '../../../uploads/onboarding');
if (!fs.existsSync(onboardingDocsDir)) {
  fs.mkdirSync(onboardingDocsDir, { recursive: true });
}

const onboardingDocStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, onboardingDocsDir);
  },
  filename: safeFilenameFromMime(DOCUMENT_MIME_EXT),
});

// Only document files are allowed for onboarding "Hujjat" tasks
const onboardingDocFileFilter = (req, file, cb) => {
  if (DOCUMENT_MIME_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Hujjat faqat PDF, DOC yoki DOCX formatida bo\'lishi kerak'));
  }
};

export const uploadOnboardingDocument = multer({
  storage: onboardingDocStorage,
  fileFilter: onboardingDocFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  }
}).single('document'); // Field name: 'document'

// =============================================
// Onboarding task submission upload (xodim "Topshirish" fayli)
// =============================================

const onboardingSubmissionsDir = path.join(__dirname, '../../../uploads/onboarding/submissions');
if (!fs.existsSync(onboardingSubmissionsDir)) {
  fs.mkdirSync(onboardingSubmissionsDir, { recursive: true });
}

// Hujjat + rasm turlari (gif'siz) — fayl "hujjat yoki rasm" bo'lishi
// kerak bo'lgan yuklashlar (topshiriq, jarima isboti) uchun umumiy.
const DOC_OR_IMAGE_MIME_EXT = {
  ...DOCUMENT_MIME_EXT,
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const onboardingSubmissionStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, onboardingSubmissionsDir);
  },
  filename: safeFilenameFromMime(DOC_OR_IMAGE_MIME_EXT),
});

// Xodim topshiradigan fayl — hujjat yoki rasm (masalan, ekran surati)
const onboardingSubmissionFileFilter = (req, file, cb) => {
  if (DOC_OR_IMAGE_MIME_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Fayl faqat PDF, DOC, DOCX yoki rasm (JPG, PNG, WEBP) formatida bo\'lishi kerak'));
  }
};

export const uploadOnboardingSubmission = multer({
  storage: onboardingSubmissionStorage,
  fileFilter: onboardingSubmissionFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max
  }
}).single('file'); // Field name: 'file'

// =============================================
// Xodimga tayinlangan jarima uchun isbot fayli (ixtiyoriy)
// =============================================

const fineFilesDir = path.join(__dirname, '../../../uploads/fines');
if (!fs.existsSync(fineFilesDir)) {
  fs.mkdirSync(fineFilesDir, { recursive: true });
}

const fineFileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, fineFilesDir);
  },
  filename: safeFilenameFromMime(DOC_OR_IMAGE_MIME_EXT),
});

const fineFileFilter = (req, file, cb) => {
  if (DOC_OR_IMAGE_MIME_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Fayl faqat PDF, DOC, DOCX yoki rasm (JPG, PNG, WEBP) formatida bo\'lishi kerak'));
  }
};

export const uploadFineFile = multer({
  storage: fineFileStorage,
  fileFilter: fineFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max
  }
}).single('file'); // Field name: 'file'

// Error handler middleware
/**
 * XAVFSIZLIK-AUDIT.md (4-pass, T-1) — YETIM QOLGAN FAYLLARNI TOZALASH.
 *
 * Multer `diskStorage` bilan faylni marshrutning ENG BOSHIDA, hali hech
 * qanday tekshiruvdan o'tmasdan diskka yozadi. Marshrut tartibi, masalan,
 * /api/v1/invites/apply da shunday edi:
 *
 *   uploadResume -> handleMulterError -> validate(Joi) -> controller -> service
 *
 * Fayl 1-qadamda yoziladi. Agar 3-qadamdagi Joi so'rovni rad etsa (422),
 * oqim servisgacha YETIB BORMAYDI — holbuki faylni o'chiradigan yagona
 * kod (invite.service.js#submitApplication ning catch bloki) aynan o'sha
 * servisning ichida. Natijada 10 MB fayl `uploads/resumes/` ichida
 * abadiy qolardi, va bunga na haqiqiy taklifnoma tokeni, na to'g'ri forma
 * ma'lumoti kerak edi — istalgan odam, internetdan, cheksiz.
 *
 * Bu middleware muammoni bitta marshrutda emas, BUTUN ILOVADA yopadi:
 * javob yakunlanganda (`finish` — xato qaytarilgan holatlarni ham
 * qamrab oladi) status >= 400 bo'lsa, shu so'rov davomida saqlangan har
 * qanday faylni o'chiradi. Muvaffaqiyatli so'rovlarga tegmaydi.
 *
 * `res.on('finish')` ataylab tanlangan: u javob mijozga to'liq
 * jo'natilgandan keyin ishlaydi, ya'ni tozalash hech qachon javobni
 * kechiktirmaydi va xato bersa ham so'rovni buzmaydi.
 */
export function cleanupOrphanedUploads(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) return;

    // memoryStorage ishlatadigan marshrutlarda (devices) `path` bo'lmaydi —
    // ular diskka hech narsa yozmaydi, shuning uchun o'tkazib yuboriladi.
    const files = [];
    if (req.file?.path) files.push(req.file.path);
    if (Array.isArray(req.files)) {
      for (const f of req.files) if (f?.path) files.push(f.path);
    } else if (req.files && typeof req.files === 'object') {
      for (const group of Object.values(req.files)) {
        if (Array.isArray(group)) for (const f of group) if (f?.path) files.push(f.path);
      }
    }

    for (const filePath of files) {
      fs.unlink(filePath, (err) => {
        // ENOENT — fayl allaqachon o'chirilgan (masalan servisning o'z
        // catch bloki tomonidan). Bu kutilgan holat, xato emas.
        if (err && err.code !== 'ENOENT') {
          console.error('Yetim faylni o\'chirishda xatolik:', filePath, err.message);
        }
      });
    }
  });

  next();
}

export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Fayl hajmi juda katta. Maksimal: 50MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Bir vaqtda maksimal 10 ta fayl yuklash mumkin'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Noto\'g\'ri fayl maydoni'
      });
    }
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Fayl yuklashda xatolik'
    });
  }

  next();
}
