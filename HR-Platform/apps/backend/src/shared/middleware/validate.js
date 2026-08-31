import Joi from 'joi';
import { HTTP_STATUS, MESSAGES } from '../../config/constants.js';

/**
 * Validation Middleware
 * Validates request body, query, and params using Joi schemas
 */

/**
 * Validate request using Joi schema
 */
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      // XAVFSIZLIK-AUDIT.md (6-pass, amaliy funksional audit): bu yerda
      // ilgari /['"]/g edi — Joi o'zining standart xabarlaridagi maydon
      // nomi atrofidagi qo'shtirnoqni ("pnfl" length must be...) olib
      // tashlash uchun. Lekin shu bir yo'la BARCHA apostrofni ham yeb
      // qo'yardi — o'zbek lotin yozuvida apostrof HARFNING QISMI
      // (bo'lim, to'lov, yo'q, o'chirish...), shuning uchun har qanday
      // maxsus (custom) xabar, unda shu harflar ishlatilgan bo'lsa,
      // "bo'lishi" o'rniga "bolishi" bo'lib chiqib ketardi (jonli sinovda
      // ikki alohida marshrutda tasdiqlandi). Joi standart xabarlarida
      // FAQAT qo'shtirnoq ishlatiladi, apostrof emas — shuning uchun
      // endi faqat "" olib tashlanadi.
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
      }));

      return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
        success: false,
        message: MESSAGES.VALIDATION_ERROR,
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
      }));

      return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
        success: false,
        message: MESSAGES.VALIDATION_ERROR,
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    req.query = value;
    next();
  };
}

/**
 * Validate URL parameters
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
      }));

      return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
        success: false,
        message: MESSAGES.VALIDATION_ERROR,
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    req.params = value;
    next();
  };
}

/**
 * Common Joi schemas for reuse
 */
// XAVFSIZLIK-AUDIT.md O-8: 8 chars with no complexity requirement was weak
// enough that the documented default passwords (K-1) — "Admin123!@#",
// "HR123!@#" — were themselves barely above the old floor. 12 chars plus
// requiring 3 of the 4 character classes raises the brute-force cost by
// several orders of magnitude without a breached-password-list dependency
// (zxcvbn/HaveIBeenPwned integration — noted as a further improvement, not
// done here to avoid adding a new runtime dependency in this pass).
const PASSWORD_CLASS_PATTERNS = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];

export const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(12)
    .max(128)
    .custom((value, helpers) => {
      const classesPresent = PASSWORD_CLASS_PATTERNS.filter((re) => re.test(value)).length;
      if (classesPresent < 3) {
        return helpers.message(
          'Parol kamida 3 turdagi belgidan iborat bo\'lishi kerak (katta harf, kichik harf, raqam, maxsus belgi)'
        );
      }
      return value;
    })
    .required(),
  phone: Joi.string().pattern(/^[\d\s\-\+\(\)]+$/).min(10).max(20),
  date: Joi.date().iso().allow('', null),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};
