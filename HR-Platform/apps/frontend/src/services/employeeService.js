import api, { withAuthToken } from './api';

/**
 * Employee Service
 * Handles all employee-related API calls
 */

// Backend origin (without /api/v1) — used for building photo URLs.
// Nisbiy bo'lsa ('' ga aylanadi) fayllar /uploads orqali nginx proxy'dan olinadi.
const API_ORIGIN = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '');

export const employeeService = {
  /**
   * Create new employee
   */
  async createEmployee(data) {
    const response = await api.post('/employees', data);
    return response.data.data;
  },

  /**
   * Get all employees
   */
  async getEmployees(params = {}) {
    const response = await api.get('/employees', { params });
    // Backend returns: { success, message, data, pagination }
    // We need to return the data array and pagination separately
    return {
      data: response.data.data,
      pagination: response.data.pagination
    };
  },

  /**
   * Fetch every employee, regardless of count — for screens that build a
   * lookup/filter/dropdown from the full roster rather than showing a
   * paginated table. `getEmployees` alone caps at 100 per page (backend
   * validation, `employees.routes.js`), so a single `{ limit: 100 }` call
   * silently dropped anyone past the 100th employee with no error and no
   * indication anything was missing. This loops pages until the backend's
   * own `pagination.totalPages` says there are no more.
   */
  async getAllEmployees(extraParams = {}) {
    const PAGE_SIZE = 100;
    let page = 1;
    let all = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, pagination } = await this.getEmployees({ ...extraParams, page, limit: PAGE_SIZE });
      all = all.concat(data);
      if (!pagination || page >= pagination.totalPages) break;
      page += 1;
    }
    return all;
  },

  /**
   * Get employee by ID
   */
  async getEmployeeById(id) {
    const response = await api.get(`/employees/${id}`);
    return response.data.data.employee;
  },

  /**
   * Update employee
   */
  async updateEmployee(id, data) {
    const response = await api.put(`/employees/${id}`, data);
    return response.data.data.employee;
  },

  /**
   * Delete employee
   */
  async deleteEmployee(id) {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },

  /**
   * Upload employee photo (avatar)
   */
  async uploadPhoto(id, file) {
    const formData = new FormData();
    formData.append('photo', file);
    // Instance default is application/json — must be overridden,
    // otherwise axios serializes FormData to JSON and the file is lost
    const response = await api.post(`/employees/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.employee;
  },

  /**
   * Upload employee resume (PDF, DOC, DOCX)
   */
  async uploadResume(id, file) {
    const formData = new FormData();
    formData.append('resume', file);
    const response = await api.post(`/employees/${id}/resume`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.employee;
  },

  /**
   * Build absolute URL for an employee photo path.
   * /uploads/employees now requires auth (see app.js) — withAuthToken
   * attaches the current access token as a query param since this URL is
   * handed straight to <img src>.
   */
  getPhotoUrl(photoUrl) {
    if (!photoUrl) return null;
    const absolute = photoUrl.startsWith('http') ? photoUrl : `${API_ORIGIN}${photoUrl}`;
    return withAuthToken(absolute);
  },

  /**
   * Build absolute URL for an employee resume path (same auth note as above).
   */
  getResumeUrl(resumeUrl) {
    if (!resumeUrl) return null;
    const absolute = resumeUrl.startsWith('http') ? resumeUrl : `${API_ORIGIN}${resumeUrl}`;
    return withAuthToken(absolute);
  },
};

export default employeeService;
