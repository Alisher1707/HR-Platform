import * as onboardingService from './onboarding.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Onboarding Controller
 */

export async function getPlans(req, res) {
  try {
    const plans = await onboardingService.listPlans();
    return successResponse(res, plans, 'Rejalar olindi');
  } catch (error) {
    console.error('Get onboarding plans error:', error);
    return errorResponse(res, error.message || 'Rejalarni olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getPlanById(req, res) {
  try {
    const plan = await onboardingService.getPlanById(req.params.id);
    return successResponse(res, plan, 'Reja olindi');
  } catch (error) {
    console.error('Get onboarding plan error:', error);
    return errorResponse(res, error.message || 'Rejani olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createPlan(req, res) {
  try {
    const plan = await onboardingService.createPlan(req.body, req.user.id);
    return successResponse(res, plan, 'Reja yaratildi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create onboarding plan error:', error);
    return errorResponse(res, error.message || 'Reja yaratishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function updatePlan(req, res) {
  try {
    const plan = await onboardingService.updatePlan(req.params.id, req.body);
    return successResponse(res, plan, 'Reja yangilandi');
  } catch (error) {
    console.error('Update onboarding plan error:', error);
    return errorResponse(res, error.message || 'Rejani yangilashda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deletePlan(req, res) {
  try {
    const result = await onboardingService.deletePlan(req.params.id);
    return successResponse(res, result, "Reja o'chirildi");
  } catch (error) {
    console.error('Delete onboarding plan error:', error);
    return errorResponse(res, error.message || "Rejani o'chirishda xatolik", error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return errorResponse(res, 'Fayl tanlanmadi', HTTP_STATUS.BAD_REQUEST);
    }
    return successResponse(
      res,
      {
        documentUrl: `/uploads/onboarding/${req.file.filename}`,
        documentName: req.file.originalname,
      },
      'Hujjat yuklandi'
    );
  } catch (error) {
    console.error('Upload onboarding document error:', error);
    return errorResponse(res, error.message || 'Hujjat yuklashda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getStats(req, res) {
  try {
    const stats = await onboardingService.getStats();
    return successResponse(res, stats, 'Statistika olindi');
  } catch (error) {
    console.error('Get onboarding stats error:', error);
    return errorResponse(res, error.message || 'Statistikani olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getAssignmentDetail(req, res) {
  try {
    const assignment = await onboardingService.getAssignmentById(req.params.id);
    return successResponse(res, assignment, 'Biriktirish tafsilotlari olindi');
  } catch (error) {
    console.error('Get onboarding assignment detail error:', error);
    return errorResponse(res, error.message || 'Tafsilotlarni olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function getAssignments(req, res) {
  try {
    const assignments = await onboardingService.listAssignments();
    return successResponse(res, assignments, 'Biriktirishlar olindi');
  } catch (error) {
    console.error('Get onboarding assignments error:', error);
    return errorResponse(res, error.message || 'Biriktirishlarni olishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createAssignment(req, res) {
  try {
    const assignment = await onboardingService.createAssignment(req.body.planId, req.body.employeeId, req.user.id);
    return successResponse(res, assignment, 'Xodimga reja biriktirildi', HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create onboarding assignment error:', error);
    return errorResponse(res, error.message || 'Reja biriktirishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deleteAssignment(req, res) {
  try {
    const result = await onboardingService.deleteAssignment(req.params.id);
    return successResponse(res, result, "Biriktirish o'chirildi");
  } catch (error) {
    console.error('Delete onboarding assignment error:', error);
    return errorResponse(res, error.message || "Biriktirishni o'chirishda xatolik", error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// --- Public (unauthenticated, token-gated) ---

export async function getPublicAssignment(req, res) {
  try {
    const assignment = await onboardingService.getAssignmentByToken(req.params.token);
    return successResponse(res, assignment, 'Reja olindi');
  } catch (error) {
    console.error('Get public onboarding assignment error:', error);
    return errorResponse(res, error.message || 'Havola topilmadi', error.statusCode || HTTP_STATUS.NOT_FOUND);
  }
}

export async function submitTask(req, res) {
  try {
    const { type, text, link } = req.body;
    if (type === 'file' && !req.file) {
      return errorResponse(res, 'Fayl tanlanmadi', HTTP_STATUS.BAD_REQUEST);
    }
    const submission = {
      type,
      text: text || '',
      link: link || '',
      file: req.file ? { url: `/uploads/onboarding/submissions/${req.file.filename}`, name: req.file.originalname } : null,
    };
    const assignment = await onboardingService.submitTask(req.params.token, req.params.taskId, submission);
    return successResponse(res, assignment, 'Vazifa topshirildi');
  } catch (error) {
    console.error('Submit onboarding task error:', error);
    return errorResponse(res, error.message || 'Vazifani topshirishda xatolik', error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
