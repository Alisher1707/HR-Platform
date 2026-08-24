import rateLimit from 'express-rate-limit';
import { RATE_LIMIT } from '../../config/constants.js';

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting the number of requests from a single IP
 */

// Camera event pushes (/api/v1/devices/:token/events) are exempt here —
// they get their own, much more generous, per-device limiter below instead
// of sharing this one. Reason: this limiter keys by IP, and every camera at
// a branch office typically exits through the same NAT'd public IP. A
// newly-added device pushing a burst of events (or several cameras behind
// one router) could exhaust this 600/15min budget in minutes, after which
// every further event from EVERY device at that IP gets silently 429'd —
// looking exactly like "the device disconnected right after being added",
// when the real cause was every device at that site sharing one IP-based
// quota with the rest of the app's traffic.
const DEVICE_EVENTS_PATH = /^\/api\/v1\/devices\/[^/]+\/events\/?$/;

/**
 * General rate limiter (100 requests per 15 minutes)
 */
export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  skip: (req) => process.env.NODE_ENV === 'development' || DEVICE_EVENTS_PATH.test(req.path),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Device event limiter — keyed by the device's own token, not IP, so
 * cameras sharing a branch's public IP never compete for the same budget.
 * 3000/15min (~3.3 req/s sustained) comfortably covers even a busy
 * access-control camera doing rapid successive face-recognition scans,
 * while still capping a single misbehaving/looping device.
 */
export const deviceEventLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: 3000,
  keyGenerator: (req) => req.params.token || req.ip,
  message: {
    success: false,
    message: 'Qurilmadan juda ko\'p so\'rov keldi, birozdan so\'ng davom etadi.',
  },
  skip: () => process.env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict limiter for auth endpoints (5 requests per 15 minutes)
 */
export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: 20,
  keyGenerator: (req) => {
    // Nginx proxy orqasida haqiqiy IP manzilni olish
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.ip;
  },
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  skip: () => process.env.NODE_ENV === 'development',
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Invite creation limiter (10 requests per hour)
 */
export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many invite creation attempts, please try again later.',
  },
  skip: () => process.env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Onboarding public-submission limiter (30 requests per hour per IP).
 * This route needs its own, tighter limiter — unlike the rest of the
 * onboarding API it takes no auth token at all (an employee reaches it via
 * a bare link), so the general limiter's much higher ceiling was the only
 * thing standing between it and someone using it to fill a disk with
 * 15MB uploads.
 */
export const onboardingSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: {
    success: false,
    message: 'Juda ko\'p urinish. Birozdan so\'ng qayta urinib ko\'ring.',
  },
  skip: () => process.env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
});
