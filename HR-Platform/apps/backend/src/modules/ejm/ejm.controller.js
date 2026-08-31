import * as ejmService from './ejm.service.js';
import { successResponse, errorResponse, safeErrorMessage } from '../../shared/utils/response.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * EJM Controller
 * Handles HTTP requests for Employee Journey Map
 */

/**
 * Get user's EJM data
 * GET /api/v1/ejm
 */
export async function getEJM(req, res) {
  try {
    const data = await ejmService.getUserEJM(req.user.id);

    return successResponse(res, data, 'EJM ma\'lumotlari olindi');
  } catch (error) {
    console.error('Get EJM error:', error);
    return errorResponse(
      res,
      safeErrorMessage(error, 'EJM ma\'lumotlarini olishda xatolik'),
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Save user's EJM data
 * POST /api/v1/ejm
 */
export async function saveEJM(req, res) {
  try {
    const { data } = req.body;

    if (!data) {
      return errorResponse(res, 'EJM ma\'lumotlari kiritilmagan', HTTP_STATUS.BAD_REQUEST);
    }

    const result = await ejmService.saveUserEJM(req.user.id, data);

    return successResponse(res, result, 'EJM saqlandi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Save EJM error:', error);
    return errorResponse(
      res,
      safeErrorMessage(error, 'EJM saqlashda xatolik'),
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Upload files to EJM node
 * POST /api/v1/ejm/upload
 */
export async function uploadFiles(req, res) {
  try {
    const { phaseIndex, nodeIndex, employeeId } = req.body;

    if (phaseIndex === undefined || nodeIndex === undefined) {
      return errorResponse(res, 'phaseIndex va nodeIndex kiritilishi shart', HTTP_STATUS.BAD_REQUEST);
    }

    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 'Fayllar tanlanmagan', HTTP_STATUS.BAD_REQUEST);
    }

    const files = await ejmService.uploadEJMFiles(
      req.user.id,
      parseInt(phaseIndex),
      parseInt(nodeIndex),
      req.files,
      employeeId || null
    );

    return successResponse(res, { files }, 'Fayllar yuklandi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Upload EJM files error:', error);
    return errorResponse(
      res,
      safeErrorMessage(error, 'Fayllarni yuklashda xatolik'),
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Get files for specific node
 * GET /api/v1/ejm/files/:phaseIndex/:nodeIndex
 * GET /api/v1/ejm/files/:phaseIndex/:nodeIndex?employeeId=xxx
 */
export async function getNodeFiles(req, res) {
  try {
    const { phaseIndex, nodeIndex } = req.params;
    const { employeeId } = req.query;

    const files = await ejmService.getNodeFiles(
      req.user.id,
      parseInt(phaseIndex),
      parseInt(nodeIndex),
      employeeId || null
    );

    return successResponse(res, { files }, 'Fayllar ro\'yxati olindi');
  } catch (error) {
    console.error('Get node files error:', error);
    return errorResponse(
      res,
      safeErrorMessage(error, 'Fayllarni olishda xatolik'),
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Download file
 * GET /api/v1/ejm/download/:fileId
 */
export async function downloadFile(req, res) {
  try {
    const { fileId } = req.params;

    const file = await ejmService.getEJMFile(fileId, req.user.id);

    // XAVFSIZLIK-AUDIT.md Y-6: `inline` + no explicit Content-Type let the
    // browser render whatever the file's on-disk EXTENSION implied —
    // before the upload-side fix (upload.js#EJM_MIME_EXT), that included
    // ".html"/".svg" uploads, which the browser would execute in this
    // origin. Uploads are now restricted to a safe mime allow-list, but
    // any file uploaded before that fix could still be sitting on disk —
    // forcing `attachment` + a fixed generic Content-Type here means even
    // a still-present old malicious file can only ever be downloaded,
    // never rendered/executed by the browser.
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type('application/octet-stream');
    res.sendFile(file.path);
  } catch (error) {
    console.error('Download file error:', error);
    return errorResponse(
      res,
      safeErrorMessage(error, 'Faylni yuklashda xatolik'),
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Delete file
 * DELETE /api/v1/ejm/files/:fileId
 */
export async function deleteFile(req, res) {
  try {
    const { fileId } = req.params;

    const result = await ejmService.deleteEJMFile(fileId, req.user.id);

    return successResponse(res, result, 'Fayl o\'chirildi');
  } catch (error) {
    console.error('Delete file error:', error);
    return errorResponse(
      res,
      safeErrorMessage(error, 'Faylni o\'chirishda xatolik'),
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
