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
 * Second, IP-keyed limiter for the camera webhook — closes the hole that
 * deviceEventLimiter alone cannot: its key is `req.params.token`, which is
 * a path segment the CALLER fully controls, so anyone can hand themselves
 * a fresh 3000-request budget just by changing it. Rotating the token made
 * that limiter a no-op, and generalLimiter deliberately skips this path.
 *
 * `skipSuccessfulRequests` is what makes an IP key safe here despite the
 * NAT concern documented above: a real camera sending a valid token gets
 * 200 and is NEVER counted, no matter how many cameras share the branch's
 * public IP. Only requests that end 4xx/5xx — i.e. unknown/invalid device
 * tokens, which is exactly what token-rotation probing looks like — count
 * against this budget.
 */
export const deviceUnknownTokenLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: 100,
  message: {
    success: false,
    message: 'Noma\'lum qurilma tokenlari bilan juda ko\'p urinish.',
  },
  skip: () => process.env.NODE_ENV === 'development',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict limiter for auth endpoints (5 requests per 15 minutes)
 *
 * XAVFSIZLIK-AUDIT.md Y-2: this used to key on the CLIENT-supplied
 * X-Forwarded-For header directly, first entry. nginx (see nginx.conf)
 * only APPENDS the real client IP to whatever X-Forwarded-For it
 * received — it doesn't replace it — so a request that already carries
 * one (fully attacker-controlled) always keeps that value in the first
 * position. Every login attempt with a new random first IP got its own
 * fresh 20-request budget, making the limiter a no-op. `app.set('trust
 * proxy', 1)` (app.js) already makes Express itself compute `req.ip`
 * correctly (the real client IP, one hop back from nginx) — no custom
 * keyGenerator is needed, or safe, here.
 */
export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: 20,
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
