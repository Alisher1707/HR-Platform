import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateEnv } from './config/env.js';
import { testConnection } from './config/database.js';
import { generalLimiter } from './shared/middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';
import { startAutoPromotionCron } from './services/autoPromotionService.js';

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
import payrollRoutes from './modules/payroll/payroll.routes.js';

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
 * Static Files - Employee photos (avatars)
 * CORP header is required because the frontend runs on a different origin
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(
  '/uploads/employees',
  express.static(path.join(__dirname, '../uploads/employees'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

/**
 * Static Files - Candidate resumes
 */
app.use(
  '/uploads/resumes',
  express.static(path.join(__dirname, '../uploads/resumes'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

/**
 * Static Files - Captured device event snapshots (diagnostic)
 */
app.use(
  '/uploads/device-events',
  express.static(path.join(__dirname, '../uploads/device-events'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

/**
 * Static Files - Onboarding task documents
 */
app.use(
  '/uploads/onboarding',
  express.static(path.join(__dirname, '../uploads/onboarding'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

/**
 * Static Files - Employee fine evidence files
 */
app.use(
  '/uploads/fines',
  express.static(path.join(__dirname, '../uploads/fines'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

/**
 * Rate Limiting
 */
app.use(generalLimiter);

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HR Platform API is running',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

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
app.use(`${API_PREFIX}/payroll`, payrollRoutes);

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
