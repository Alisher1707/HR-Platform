import * as payrollService from './payroll.service.js';
import { successResponse, errorResponse, safeErrorMessage } from '../../shared/utils/response.js';
import { HTTP_STATUS } from '../../config/constants.js';
import { recordAuditEvent, actorIp } from '../../services/auditLogService.js';

/**
 * Payroll Controller
 */

export async function getPayments(req, res) {
  try {
    const {
      employeeId, branches, departments, positions, scheduleIds, month, year, startDate, endDate,
    } = req.query;

    const payments = await payrollService.listPayments({
      employeeId: employeeId || null,
      branches: branches ? branches.split(',').filter(Boolean) : [],
      departments: departments ? departments.split(',').filter(Boolean) : [],
      positions: positions ? positions.split(',').filter(Boolean) : [],
      scheduleIds: scheduleIds ? scheduleIds.split(',').filter(Boolean) : [],
      month: month || null,
      year: year || null,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    // XAVFSIZLIK-AUDIT.md P-8: maosh to'lovlari — nozik moliyaviy
    // ma'lumot. Kim, qachon, qaysi filtr bilan ko'rgani qayd etiladi.
    recordAuditEvent({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'payroll.sensitive_read',
      resourceType: 'payroll_payment',
      resourceId: employeeId || null,
      ipAddress: actorIp(req),
      meta: { month: month || null, year: year || null },
    });

    return successResponse(res, payments, "To'lovlar olindi");
  } catch (error) {
    console.error('Get payments error:', error);
    return errorResponse(res, safeErrorMessage(error, "To'lovlarni olishda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function createPayment(req, res) {
  try {
    const { employeeId, amount, month, year, note } = req.body;

    const payment = await payrollService.createPayment({
      employeeId,
      amount,
      month,
      year,
      note,
      createdBy: req.user.id,
    });

    return successResponse(res, payment, "To'lov qo'shildi", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Create payment error:', error);
    return errorResponse(res, safeErrorMessage(error, "To'lov qo'shishda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function deletePayment(req, res) {
  try {
    const result = await payrollService.deletePayment(req.params.id);
    return successResponse(res, result, "To'lov o'chirildi");
  } catch (error) {
    console.error('Delete payment error:', error);
    return errorResponse(res, safeErrorMessage(error, "To'lovni o'chirishda xatolik"), error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
