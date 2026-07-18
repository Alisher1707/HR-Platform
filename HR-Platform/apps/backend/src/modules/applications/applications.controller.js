import { asyncHandler } from '../../shared/middleware/errorHandler.js';
import { successResponse } from '../../shared/utils/response.js';
import { MESSAGES } from '../../config/constants.js';
import * as applicationsService from './applications.service.js';

/**
 * Applications Controller
 * Handles HTTP requests for Kanban board
 */

/**
 * GET /api/v1/applications
 * Get all applications grouped by status
 */
export const getAllApplications = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    assignedTo: req.query.assignedTo,
    search: req.query.search,
  };

  const applications = await applicationsService.getAllApplications(filters);

  return successResponse(res, { applications }, 'Applications retrieved successfully');
});

/**
 * GET /api/v1/applications/:id
 * Get application by ID
 */
export const getApplicationById = asyncHandler(async (req, res) => {
  const application = await applicationsService.getApplicationById(req.params.id);

  return successResponse(res, { application }, 'Application retrieved successfully');
});

/**
 * PATCH /api/v1/applications/:id/status
 * Update application status (move between Kanban columns)
 */
export const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, comment, interviewDate, sinovStartDate, sinovEndDate } = req.body;

  const application = await applicationsService.updateApplicationStatus(
    req.params.id,
    status,
    req.user.id,
    comment,
    interviewDate,
    sinovStartDate,
    sinovEndDate
  );

  return successResponse(res, { application }, MESSAGES.APPLICATION_UPDATED);
});

/**
 * PATCH /api/v1/applications/:id/order
 * Update application order (reorder within same column)
 */
export const updateApplicationOrder = asyncHandler(async (req, res) => {
  const { orderIndex } = req.body;

  const application = await applicationsService.updateApplicationOrder(req.params.id, orderIndex);

  return successResponse(res, { application }, 'Application order updated successfully');
});

/**
 * PUT /api/v1/applications/:id
 * Update application details
 */
export const updateApplication = asyncHandler(async (req, res) => {
  const updates = {
    position: req.body.position,
    notes: req.body.notes,
    assignedTo: req.body.assignedTo,
    interviewStatus: req.body.interviewStatus,
  };

  // Remove undefined values
  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });

  const application = await applicationsService.updateApplication(req.params.id, updates, req.user.id);

  return successResponse(res, { application }, MESSAGES.APPLICATION_UPDATED);
});

/**
 * GET /api/v1/applications/:id/history
 * Get application change history
 */
export const getApplicationHistory = asyncHandler(async (req, res) => {
  const history = await applicationsService.getApplicationHistory(req.params.id);

  return successResponse(res, { history, total: history.length }, 'Application history retrieved successfully');
});
