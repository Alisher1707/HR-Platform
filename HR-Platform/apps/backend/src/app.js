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
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

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
 * Static Files - Onboarding task documents & employee submissions
 * Intentionally unauthenticated — see comment above.
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
  try {
    await query('SELECT 1');
    res.status(200).json({
      success: true,
      message: 'HR Platform API is running',
      timestamp: new Date().toISOString(),
      environment: config.env,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Database unavailable',
      timestamp: new Date().toISOString(),
      environment: config.env,
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

/**
 * API Documentation Root
 */
app.get(API_PREFIX, (req, res) => {
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
