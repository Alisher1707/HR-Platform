import * as ejmService from './ejm.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
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
      error.message || 'EJM ma\'lumotlarini olishda xatolik',
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
      error.message || 'EJM saqlashda xatolik',
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
    const { phaseIndex, nodeIndex } = req.body;

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
      req.files
    );

    return successResponse(res, { files }, 'Fayllar yuklandi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Upload EJM files error:', error);
    return errorResponse(
      res,
      error.message || 'Fayllarni yuklashda xatolik',
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Get files for specific node
 * GET /api/v1/ejm/files/:phaseIndex/:nodeIndex
 */
export async function getNodeFiles(req, res) {
  try {
    const { phaseIndex, nodeIndex } = req.params;

    const files = await ejmService.getNodeFiles(
      req.user.id,
      parseInt(phaseIndex),
      parseInt(nodeIndex)
    );

    return successResponse(res, { files }, 'Fayllar ro\'yxati olindi');
  } catch (error) {
    console.error('Get node files error:', error);
    return errorResponse(
      res,
      error.message || 'Fayllarni olishda xatolik',
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

    res.download(file.path, file.name);
  } catch (error) {
    console.error('Download file error:', error);
    return errorResponse(
      res,
      error.message || 'Faylni yuklashda xatolik',
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
      error.message || 'Faylni o\'chirishda xatolik',
      error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
