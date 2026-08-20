import * as finesService from './fines.service.js';
import { notifyAppealReviewed, notifyFineCreated } from '../telegram/telegramBot.service.js';
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

export async function deleteFineType(req, res) {
  try {
    const result = await finesService.deleteFineType(req.params.id);
    return successResponse(res, result, 'Jazo turi o\'chirildi');
  } catch (error) {
    console.error('Delete fine type error:', error);
    return errorResponse(res, error.message || 'Jazo turini o\'chirishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
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

export async function getAssignedFines(req, res) {
  try {
    const { employeeId, branches, departments, positions, scheduleIds, startDate, endDate } = req.query;

    const fines = await finesService.listEmployeeFines({
      employeeId: employeeId || null,
      branches: branches ? branches.split(',').filter(Boolean) : [],
      departments: departments ? departments.split(',').filter(Boolean) : [],
      positions: positions ? positions.split(',').filter(Boolean) : [],
      scheduleIds: scheduleIds ? scheduleIds.split(',').filter(Boolean) : [],
      startDate: startDate || null,
      endDate: endDate || null,
    });

    return successResponse(res, fines, 'Tayinlangan jarimalar olindi');
  } catch (error) {
    console.error('Get assigned fines error:', error);
    return errorResponse(res, error.message || 'Tayinlangan jarimalarni olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createAssignedFine(req, res) {
  try {
    const { employeeId, amount, fineTypeId, note } = req.body;

    const fine = await finesService.createEmployeeFine({
      employeeId,
      amount,
      fineTypeId: fineTypeId || null,
      note,
      fileUrl: req.file ? `/uploads/fines/${req.file.filename}` : null,
      fileName: req.file ? req.file.originalname : null,
      createdBy: req.user.id,
    });

    notifyFineCreated(fine.employeeId, { amount: fine.amount, note: fine.note });

    return successResponse(res, fine, 'Jarima tayinlandi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create assigned fine error:', error);
    return errorResponse(res, error.message || 'Jarima tayinlashda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function updatePunishmentStatus(req, res) {
  try {
    const { status, note } = req.body;

    const fine = await finesService.updateFinePunishmentStatus(req.params.id, {
      status,
      note,
      recordedBy: req.user.id,
    });

    return successResponse(res, fine, "Jazo holati saqlandi");
  } catch (error) {
    console.error('Update punishment status error:', error);
    return errorResponse(res, error.message || "Jazo holatini saqlashda xatolik", error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteAssignedFine(req, res) {
  try {
    const result = await finesService.deleteEmployeeFine(req.params.id);
    return successResponse(res, result, 'Jarima o\'chirildi');
  } catch (error) {
    console.error('Delete assigned fine error:', error);
    return errorResponse(res, error.message || 'Jarimani o\'chirishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getFineAppeals(req, res) {
  try {
    const appeals = await finesService.listFineAppeals({ status: req.query.status || null });
    return successResponse(res, appeals, 'Tushuntirish xatlari olindi');
  } catch (error) {
    console.error('Get fine appeals error:', error);
    return errorResponse(res, error.message || 'Tushuntirish xatlarini olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function reviewFineAppeal(req, res) {
  try {
    const { status, note } = req.body;

    const appeal = await finesService.reviewFineAppeal(req.params.id, {
      status,
      note,
      reviewedBy: req.user.id,
    });

    notifyAppealReviewed(appeal.employeeId, {
      status: appeal.status,
      note: appeal.reviewNote,
      fineAmount: appeal.fineAmount,
      fineTypeName: appeal.fineTypeName,
    });

    return successResponse(res, appeal, 'Ariza ko\'rib chiqildi');
  } catch (error) {
    console.error('Review fine appeal error:', error);
    return errorResponse(res, error.message || 'Arizani ko\'rib chiqishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
