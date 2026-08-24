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

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp_userId_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${uniqueSuffix}_${sanitizedName}${ext}`);
  }
});

// File filter - allow all types
const fileFilter = (req, file, cb) => {
  // Allow all file types as requested
  cb(null, true);
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
