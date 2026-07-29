import express from 'express';
import * as ejmController from './ejm.controller.js';
import { authenticate, authorize, authenticateFromQuery } from '../auth/auth.middleware.js';
import { uploadEJMFile, handleMulterError } from '../../shared/middleware/upload.js';
import { USER_ROLES } from '../../config/constants.js';

const router = express.Router();

/**
 * EJM Routes
 * All routes require authentication
 */

// Get user's EJM data
router.get('/', authenticate, authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR), ejmController.getEJM);

// Save user's EJM data
router.post('/', authenticate, authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR), ejmController.saveEJM);

// Upload files to specific node
router.post('/upload', authenticate, authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR), uploadEJMFile, handleMulterError, ejmController.uploadFiles);

// Get files for specific node
router.get('/files/:phaseIndex/:nodeIndex', authenticate, authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR), ejmController.getNodeFiles);

// Download file - uses query param token for iframe/new tab compatibility
router.get('/download/:fileId', authenticateFromQuery, authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.HR), ejmController.downloadFile);

// Delete file
router.delete('/files/:fileId', authenticate, authorize(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), ejmController.deleteFile);

export default router;
