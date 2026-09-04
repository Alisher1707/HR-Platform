import { HTTP_STATUS, MESSAGES } from '../../config/constants.js';
import { config } from '../../config/env.js';

/**
 * Global Error Handler Middleware
 * Catches all errors and sends standardized error responses.
 *
 * Two things are kept strictly separate here, on purpose:
 *  1. What gets LOGGED (server-side, always, every environment) — full
 *     detail, so a real incident can actually be investigated afterwards.
 *  2. What gets SENT to the client — an intentional business error (one our
 *     own code threw with a statusCode, e.g. "Xodim topilmadi") is safe to
 *     show as-is; an *unexpected* error (a real bug, a raw Postgres/driver
 *     exception) is never shown verbatim, since its message can leak
 *     internal schema/implementation details to whoever is calling the API.
 */
export function errorHandler(err, req, res, next) {
  // Our own service code always sets statusCode on intentional errors
  // ("Xodim topilmadi", "Invite already used", etc.) — that message is
  // meant to be user-facing. Anything without one is an unanticipated
  // exception (a bug, a raw driver/library error) and must not be echoed.
  const isKnownError = typeof err.statusCode === 'number';

  let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = isKnownError ? err.message : MESSAGES.SERVER_ERROR;
  let errors = err.errors || null;

  // Joi validation error
  if (err.isJoi) {
    statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
    message = MESSAGES.VALIDATION_ERROR;
    errors = err.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = MESSAGES.TOKEN_INVALID;
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = MESSAGES.TOKEN_EXPIRED;
  }

  // PostgreSQL errors
  if (err.code === '23505') {
    // Unique violation
    statusCode = HTTP_STATUS.CONFLICT;
    message = 'Resource already exists';
  }

  if (err.code === '23503') {
    // Foreign key violation
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Referenced resource not found';
  }

  if (err.code === '22P02') {
    // Invalid text representation
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Invalid data format';
  }

  // Always log server-side — every environment, not just development.
  // A production 500 with no log trail is undebuggable; this is the
  // difference between "a user reported an error" and "we know exactly
  // which request, on which route, threw what".
  const logPayload = {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: err.message,
    userId: req.user?.id,
  };
  if (statusCode >= 500) {
    console.error('❌ Server error:', logPayload, '\n', err.stack);
  } else if (config.env === 'development') {
    console.error('❌ Request error:', logPayload);
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(config.env === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Not Found Handler
 * Handles 404 errors for undefined routes
 */
export function notFoundHandler(req, res) {
  // XAVFSIZLIK-AUDIT.md (4-pass, qattiqlashtirish): javob ilgari
  // `req.originalUrl` ni, ya'ni chaqiruvchi yuborgan xom matnni qaytarardi.
  // JSON + `nosniff` (helmet) tufayli bu brauzerda bajarilmaydi, shuning
  // uchun haqiqiy XSS emas edi — lekin foydalanuvchi kiritgan matnni
  // javobga qaytarish uchun hech qanday sabab ham yo'q. Yo'lning o'zi
  // server logida (errorHandler#logPayload) qoladi, ya'ni nosozlikni
  // aniqlash imkoniyati yo'qolmaydi.
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: 'Not found',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors automatically
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
