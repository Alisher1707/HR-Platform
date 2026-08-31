import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateEnv } from './config/env.js';
import { testConnection, query } from './config/database.js';
import { generalLimiter } from './shared/middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';
import { serveUploadedFile } from './shared/middleware/serveUploads.js';
import { authenticateFromQuery, authorize } from './modules/auth/auth.middleware.js';
import { USER_ROLES } from './config/constants.js';
import { startAutoPromotionCron } from './services/autoPromotionService.js';
import { startAutoFineCron, startCheckoutResolutionCron } from './services/autoFineService.js';
import { startDeviceEventsCleanupCron } from './services/deviceEventsCleanupService.js';
import { startRefreshTokenCleanupCron } from './modules/auth/refreshToken.service.js';
import { pool } from './config/database.js';
import { canAccessSubmissionFile } from './modules/onboarding/onboarding.service.js';

// Import routes
import authRoutes from './modules/auth/auth.routes.js';
import inviteRoutes from './modules/invite/invite.routes.js';
import employeesRoutes from './modules/employees/employees.routes.js';
import applicationsRoutes from './modules/applications/applications.routes.js';
import ejmRoutes from './modules/ejm/ejm.routes.js';
import devicesRoutes from './modules/devices/devices.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import schedulesRoutes from './modules/schedules/schedules.routes.js';
import finesRoutes from './modules/fines/fines.routes.js';
import onboardingRoutes from './modules/onboarding/onboarding.routes.js';
import departmentsRoutes from './modules/departments/departments.routes.js';
import payrollRoutes from './modules/payroll/payroll.routes.js';
import telegramRoutes from './modules/telegram/telegram.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import { ensureWebhookRegistered } from './modules/telegram/telegramApi.js';

/**
 * Initialize Express Application
 */
const app = express();

// Trust first proxy (nginx) — req.ip va req.hostname to'g'ri ishlashi uchun
app.set('trust proxy', 1);

/**
 * Validate environment variables
 */
try {
  validateEnv();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

// XAVFSIZLIK-AUDIT.md Y-1: NODE_ENV=development effectively disables several
// protections at once (rate limiting fully skipped — see rateLimiter.js,
// stack traces returned to clients — see errorHandler.js, refresh cookie
// missing `Secure` — see constants.js) and this has previously happened
// on production by accident (a stray `.env` value overriding
// docker-compose's own production default). Impossible to miss in logs now.
if (config.env !== 'production') {
  console.warn('\n' + '⚠️ '.repeat(20));
  console.warn(`⚠️  DIQQAT: NODE_ENV="${config.env}" — bu PRODUCTION emas!`);
  console.warn('⚠️  Rate limiting O\'CHIQ, xato stack trace\'lari mijozga qaytadi,');
  console.warn('⚠️  refresh cookie Secure bayrog\'isiz. Agar bu production server bo\'lsa,');
  console.warn('⚠️  DARHOL to\'xtating va .env\'da NODE_ENV=production qiling.');
  console.warn('⚠️ '.repeat(20) + '\n');
}

/**
 * Security Middleware
 */
app.use(helmet()); // Security headers

/**
 * CORS Configuration
 */
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/**
 * Body Parser Middleware
 */
// 10mb applied to every JSON-bodied route (nothing here legitimately needs
// anywhere near that — file uploads all go through multer/multipart, not
// JSON) was an easy, cheap memory-exhaustion DoS lever. 1mb comfortably
// covers the largest real payload (bulk employee import, up to 500 rows)
// with headroom, while cutting the worst-case body size 10x
// (XAVFSIZLIK-AUDIT.md P-7).
app.use(express.json({ limit: '1mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Parse URL-encoded bodies

/**
 * Cookie Parser Middleware
 */
app.use(cookieParser());

/**
 * Uploaded Files
 *
 * These used to be plain `express.static` mounts — reachable by anyone who
 * had (or could guess) a URL, no login required. That meant employee
 * photos, candidate resumes, fine evidence and Telegram-submitted appeal
 * documents were all effectively public on the internet. Every one of
 * those now requires a valid, still-active user session; only the
 * onboarding directory stays unauthenticated, because that's the one
 * genuinely public surface here — an employee fills out their onboarding
 * checklist through a dedicated unauthenticated link (public_token), never
 * logging in at all (see onboarding.service.js), so task documents/
 * submissions must be reachable the same way.
 *
 * `authenticateFromQuery` (not the header-based `authenticate`) is used
 * because these URLs are consumed directly by `<img src>`/`<a href>`,
 * which can't attach an Authorization header — the same tradeoff the EJM
 * download route already made. The access token still expires in minutes
 * and every request still requires ADMIN/SUPER_ADMIN/HR, which is a world
 * away from "no auth at all"; a fully header-based fetch+blob-URL scheme
 * would close the token-in-URL surface entirely but touches every photo/
 * file usage across the frontend, which is out of scope for this pass.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const canManageUploads = authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR);

// XAVFSIZLIK-AUDIT.md (3-pass, #11): `app.use(generalLimiter)` sits further
// down this file, AFTER every route below — so none of the /uploads
// surface was ever rate limited. Only /health is meant to be exempt (it is
// polled by Docker's HEALTHCHECK and says so explicitly); the uploads
// routes ended up exempt purely by declaration order, not by decision.
// That mattered most for the one genuinely unauthenticated route in this
// group — /uploads/onboarding/submissions/:filename, reachable with just a
// public assignment token and running a DB query per request — which had
// no ceiling of any kind. Applying the same limiter here (same instance,
// so it shares one budget with the rest of the app) closes that without
// touching the deliberate /health exemption.
app.use('/uploads', generalLimiter);

app.get(
  '/uploads/employees/:filename',
  authenticateFromQuery,
  canManageUploads,
  serveUploadedFile(path.join(__dirname, '../uploads/employees'))
);

app.get(
  '/uploads/resumes/:filename',
  authenticateFromQuery,
  canManageUploads,
  serveUploadedFile(path.join(__dirname, '../uploads/resumes'))
);

app.get(
  '/uploads/device-events/:filename',
  authenticateFromQuery,
  canManageUploads,
  serveUploadedFile(path.join(__dirname, '../uploads/device-events'))
);

app.get(
  '/uploads/fines/:filename',
  authenticateFromQuery,
  canManageUploads,
  serveUploadedFile(path.join(__dirname, '../uploads/fines'))
);

app.get(
  '/uploads/appeals/:filename',
  authenticateFromQuery,
  canManageUploads,
  serveUploadedFile(path.join(__dirname, '../uploads/appeals'))
);

/**
 * Onboarding submissions (passport copies, diplomas, etc. an employee
 * uploaded) — registered BEFORE the general onboarding static mount below
 * so it intercepts this one subpath first.
 *
 * XAVFSIZLIK-AUDIT.md O-1: these used to be served by the same fully
 * unauthenticated `express.static` mount as the task *reference* documents
 * (videos/PDFs HR attaches to a step — those are genuinely meant to be
 * public, no employee data in them). A submission's protection was only
 * ever "the filename is a random 32-hex string" — with no expiry, no
 * revocation, forever, even long after the onboarding link itself expired.
 * This still isn't a full fix (it confirms *some* onboarding link is still
 * live, not that this token was ever issued for *this specific* file —
 * that would need the file lookup to join back through
 * onboarding_step_completions, a larger change) but it closes the actual
 * gap the audit called out: access no longer outlives the assignment.
 */
app.get('/uploads/onboarding/submissions/:filename', async (req, res, next) => {
  try {
    const staffToken = req.query.token;
    if (staffToken) {
      return authenticateFromQuery(req, res, (err) => {
        if (err) return next(err);
        return canManageUploads(req, res, () =>
          serveUploadedFile(path.join(__dirname, '../uploads/onboarding/submissions'))(req, res)
        );
      });
    }

    // XAVFSIZLIK-AUDIT.md (3-pass qayta-audit, #13): bu yerda ilgari faqat
    // "biror onboarding havolasi hali tirikmi" deb so'ralardi — ya'ni
    // ISTALGAN tirik havola egasi BOSHQA xodimning passport/diplom
    // nusxasini yuklab olishi mumkin edi; yagona to'siq — fayl nomining
    // tasodifiyligi, ya'ni aynan O-1 topilmasi qoralagan "obscurity"
    // himoyasi. Endi token shu faylga HAQIQATAN egalik qilishi tekshiriladi.
    const allowed = await canAccessSubmissionFile(req.query.assignmentToken, req.params.filename);
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Fayl topilmadi' });
    }
    return serveUploadedFile(path.join(__dirname, '../uploads/onboarding/submissions'))(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * Static Files - Onboarding task reference documents (HR-authored,
 * genuinely public — see comment above for why submissions/ is split out).
 */
app.use(
  '/uploads/onboarding',
  express.static(path.join(__dirname, '../uploads/onboarding'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

/**
 * Health Check Endpoint
 *
 * Docker's HEALTHCHECK (see Dockerfile) polls this every 30s to decide
 * whether the container is "healthy" and should keep receiving traffic /
 * not be restarted — deliberately mounted BEFORE the rate limiter below,
 * so that frequent, legitimate polling can never itself get throttled.
 * It used to return 200 unconditionally — meaning a fully dead database
 * still left the container marked healthy, so nothing would ever trigger
 * a restart even though every real request was failing. A quick
 * `SELECT 1` actually exercises the connection pool the app depends on.
 */
app.get('/health', async (req, res) => {
  // `environment` used to be echoed back here unauthenticated — free
  // reconnaissance for an attacker probing for a misconfigured/non-prod
  // deployment (XAVFSIZLIK-AUDIT.md P-5). Nothing here needs it publicly;
  // it's still in every startup log line for whoever operates the box.
  try {
    await query('SELECT 1');
    res.status(200).json({
      success: true,
      message: 'HR Platform API is running',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Database unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Rate Limiting
 */
app.use(generalLimiter);

/**
 * API Routes
 */
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/invites`, inviteRoutes);
app.use(`${API_PREFIX}/employees`, employeesRoutes);
app.use(`${API_PREFIX}/applications`, applicationsRoutes);
app.use(`${API_PREFIX}/ejm`, ejmRoutes);
app.use(`${API_PREFIX}/devices`, devicesRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/schedules`, schedulesRoutes);
app.use(`${API_PREFIX}/fines`, finesRoutes);
app.use(`${API_PREFIX}/onboarding`, onboardingRoutes);
app.use(`${API_PREFIX}/departments`, departmentsRoutes);
app.use(`${API_PREFIX}/payroll`, payrollRoutes);
app.use(`${API_PREFIX}/telegram`, telegramRoutes);
app.use(`${API_PREFIX}/audit-logs`, auditRoutes);

/**
 * API Documentation Root — the full endpoint map is only handed out
 * unauthenticated outside production (local dev / demo convenience); in
 * production it's free reconnaissance for nothing but a name (nothing here
 * is secret to someone reading the source, but there's no reason to make
 * an attacker's job easier). XAVFSIZLIK-AUDIT.md P-4.
 */
app.get(API_PREFIX, (req, res) => {
  if (config.env === 'production') {
    return res.json({ success: true, message: 'HR Platform API v1', version: '1.0.0' });
  }
  res.json({
    success: true,
    message: 'HR Platform API v1',
    version: '1.0.0',
    endpoints: {
      auth: `${API_PREFIX}/auth`,
      invites: `${API_PREFIX}/invites`,
      employees: `${API_PREFIX}/employees`,
      applications: `${API_PREFIX}/applications`,
      ejm: `${API_PREFIX}/ejm`,
      devices: `${API_PREFIX}/devices`,
      attendance: `${API_PREFIX}/attendance`,
      schedules: `${API_PREFIX}/schedules`,
    },
    documentation: 'See README.md for API documentation',
  });
});

/**
 * 404 Handler - Must be after all routes
 */
app.use(notFoundHandler);

/**
 * Global Error Handler - Must be last
 */
app.use(errorHandler);

/**
 * Start Server
 */
async function startServer() {
  try {
    // Test database connection
    await testConnection();

    // Start auto-promotion cron job
    startAutoPromotionCron();

    // Start auto-fine cron job (kelmagan_kun / chiqish_yoq daily sweep)
    startAutoFineCron();

    // Resolve "pending" ketdi scans into a real Erta ketdi/boundary verdict
    // once each employee's own schedule end time has passed with no return
    startCheckoutResolutionCron();

    // Eski (heartbeat) qurilma hodisalarini 30 kundan keyin tozalash
    startDeviceEventsCleanupCron();

    // Eskirgan/bekor qilingan refresh tokenlarni tozalash
    startRefreshTokenCleanupCron(pool);

    // Register the Telegram webhook (no-op if not configured, e.g. local dev)
    ensureWebhookRegistered();

    // Start listening
    app.listen(config.port, () => {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 HR Platform Backend Server Started!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Environment:  ${config.env}`);
      console.log(`🌐 Server URL:   http://localhost:${config.port}`);
      console.log(`🔗 API Endpoint: http://localhost:${config.port}${API_PREFIX}`);
      console.log(`💚 Health Check: http://localhost:${config.port}/health`);
      console.log(`🎨 Frontend URL: ${config.frontendUrl}`);
      console.log(`⏰ Auto-Promotion: Active (every 5 minutes)`);
      console.log(`⚖️  Auto-Fine: Active (every 30 minutes)`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

export default app;
