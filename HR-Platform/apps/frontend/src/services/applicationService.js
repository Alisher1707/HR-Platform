import api from './api';

/**
 * Application Service
 * Handles all application (Kanban) related API calls
 */

// Backend origin (without /api/v1) — used for building resume file URLs
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');

export const applicationService = {
  /**
   * Get all applications grouped by status
   */
  async getApplications(params = {}) {
    const response = await api.get('/applications', { params });
    const appsGrouped = response.data.data.applications;

    const flatApps = [];
    if (appsGrouped) {
      if (Array.isArray(appsGrouped)) {
        flatApps.push(...appsGrouped);
      } else {
        Object.values(appsGrouped).forEach(list => {
          if (Array.isArray(list)) {
            flatApps.push(...list);
          }
        });
      }
    }

    return flatApps.map(app => ({
      ...app,
      firstName: app.employee?.first_name || '',
      lastName: app.employee?.last_name || '',
      employeeNumber: app.employee?.employee_number || '',
      phone: app.employee?.phone || '',
      email: app.employee?.email || '',
      birthDate: app.employee?.birth_date || null,
      joinDate: app.employee?.join_date || null,
      pnfl: app.employee?.pnfl || '',
      branch: app.employee?.branch || '',
      department: app.employee?.department || '',
      employeePosition: app.employee?.position || '',
      salaryType: app.employee?.salary_type || '',
      salaryAmount: app.employee?.salary_amount || null,
      employeeStatus: app.employee?.status || '',
      kpiTemplate: app.employee?.kpi_template || '',
      telegramUsername: app.employee?.telegram_username || '',
      resumeUrl: app.employee?.resume_url || null,
      resumeOriginalName: app.employee?.resume_original_name || '',
      createdAt: app.created_at,
      interviewDate: app.interview_date || null,
      sinovStartDate: app.sinov_start_date || null,
      sinovEndDate: app.sinov_end_date || null,
      experience: app.employee?.experience || 0,
      address: app.employee?.address || '',
      age: app.employee?.age || null,
      assignedTo: app.assigned_to?.id || app.assigned_to || '',
    }));
  },

  /**
   * Get application by ID
   */
  async getApplicationById(id) {
    const response = await api.get(`/applications/${id}`);
    return response.data.data.application;
  },

  /**
   * Update application status (move between columns)
   */
  async updateApplicationStatus(id, status, comment, interviewDate, sinovStartDate, sinovEndDate) {
    const body = { status, comment };
    if (interviewDate !== undefined) {
      body.interviewDate = interviewDate;
    }
    if (sinovStartDate !== undefined) {
      body.sinovStartDate = sinovStartDate;
    }
    if (sinovEndDate !== undefined) {
      body.sinovEndDate = sinovEndDate;
    }
    const response = await api.patch(`/applications/${id}/status`, body);
    return response.data.data.application;
  },

  /**
   * Update application order (reorder within column)
   */
  async updateApplicationOrder(id, orderIndex) {
    const response = await api.patch(`/applications/${id}/order`, {
      orderIndex,
    });
    return response.data.data.application;
  },

  /**
   * Update application details
   */
  async updateApplication(id, data) {
    const response = await api.put(`/applications/${id}`, data);
    return response.data.data.application;
  },

  /**
   * Get application history
   */
  async getApplicationHistory(id) {
    const response = await api.get(`/applications/${id}/history`);
    return response.data.data.history;
  },

  /**
   * Build absolute URL for a candidate resume path
   */
  getResumeUrl(resumeUrl) {
    if (!resumeUrl) return null;
    return resumeUrl.startsWith('http') ? resumeUrl : `${API_ORIGIN}${resumeUrl}`;
  },
};

export default applicationService;
