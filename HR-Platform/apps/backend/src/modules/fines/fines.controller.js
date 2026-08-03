import * as finesService from './fines.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Fines Controller
 */

export async function getFineTypes(req, res) {
  try {
    const types = await finesService.listFineTypes();
    return successResponse(res, types, 'Jazo turlari olindi');
  } catch (error) {
    console.error('Get fine types error:', error);
    return errorResponse(res, error.message || 'Jazo turlarini olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createFineType(req, res) {
  try {
    const type = await finesService.createFineType(req.body.name, req.user.id);
    return successResponse(res, type, 'Jazo turi yaratildi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create fine type error:', error);
    return errorResponse(res, error.message || 'Jazo turi yaratishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getFinePolicies(req, res) {
  try {
    const policies = await finesService.listFinePolicies();
    return successResponse(res, policies, 'Jarima siyosatlari olindi');
  } catch (error) {
    console.error('Get fine policies error:', error);
    return errorResponse(res, error.message || 'Jarima siyosatlarini olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getFinePolicyById(req, res) {
  try {
    const policy = await finesService.getFinePolicyById(req.params.id);
    return successResponse(res, policy, 'Jarima siyosati olindi');
  } catch (error) {
    console.error('Get fine policy error:', error);
    return errorResponse(res, error.message || 'Jarima siyosatini olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createFinePolicy(req, res) {
  try {
    const policy = await finesService.createFinePolicy(req.body, req.user.id);
    return successResponse(res, policy, 'Jarima siyosati yaratildi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create fine policy error:', error);
    return errorResponse(res, error.message || 'Jarima siyosati yaratishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function updateFinePolicy(req, res) {
  try {
    const policy = await finesService.updateFinePolicy(req.params.id, req.body);
    return successResponse(res, policy, 'Jarima siyosati yangilandi');
  } catch (error) {
    console.error('Update fine policy error:', error);
    return errorResponse(res, error.message || 'Jarima siyosatini yangilashda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteFinePolicy(req, res) {
  try {
    const result = await finesService.deleteFinePolicy(req.params.id);
    return successResponse(res, result, 'Jarima siyosati o\'chirildi');
  } catch (error) {
    console.error('Delete fine policy error:', error);
    return errorResponse(res, error.message || 'Jarima siyosatini o\'chirishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
