import { asyncHandler } from '../../shared/middleware/errorHandler.js';
import { paginatedResponse } from '../../shared/utils/response.js';
import * as auditService from './audit.service.js';

/**
 * GET /api/v1/audit-logs
 * SUPER_ADMIN only — see audit.routes.js. Imtiyozli amallar jurnalini
 * ko'radi (XAVFSIZLIK-AUDIT.md O-12 / P-8).
 */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const filters = {
    action: req.query.action,
    actorUserId: req.query.actorUserId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 50,
  };

  const result = await auditService.listAuditLogs(filters, pagination);

  return paginatedResponse(res, result.logs, result.pagination, 'Audit logs retrieved successfully');
});
