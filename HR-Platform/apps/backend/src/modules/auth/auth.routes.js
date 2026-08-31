import express from 'express';
import Joi from 'joi';
import * as authController from './auth.controller.js';
import { authenticate } from './auth.middleware.js';
import { validate } from '../../shared/middleware/validate.js';
import { authLimiter } from '../../shared/middleware/rateLimiter.js';
import { commonSchemas } from '../../shared/middleware/validate.js';

const router = express.Router();

/**
 * Validation Schemas
 */

const loginSchema = Joi.object({
  email: commonSchemas.email,
  password: Joi.string().required(),
});

const registerSchema = Joi.object({
  token: Joi.string().length(64).required(),
  email: commonSchemas.email,
  password: commonSchemas.password,
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: commonSchemas.password,
});

/**
 * Routes
 */

// POST /api/v1/auth/login
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// POST /api/v1/auth/register
// authLimiter added (XAVFSIZLIK-AUDIT.md O-10) — the invite token itself is
// unguessable (64 hex chars), but without a limiter this endpoint let
// anyone force the server to run bcrypt(12) an unbounded number of times
// per second, a cheap CPU-exhaustion DoS lever that cost the caller nothing.
router.post('/register', authLimiter, validate(registerSchema), authController.register);

// POST /api/v1/auth/refresh
router.post('/refresh', authController.refresh);

// POST /api/v1/auth/logout
router.post('/logout', authenticate, authController.logout);

// GET /api/v1/auth/me
router.get('/me', authenticate, authController.me);

// PATCH /api/v1/auth/password — change own password (XAVFSIZLIK-AUDIT.md O-9)
router.patch('/password', authenticate, authLimiter, validate(changePasswordSchema), authController.changePassword);

export default router;
