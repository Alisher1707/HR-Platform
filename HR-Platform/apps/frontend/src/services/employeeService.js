import api from './api';

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
   * Build absolute URL for an employee photo path
   */
  getPhotoUrl(photoUrl) {
    if (!photoUrl) return null;
    return photoUrl.startsWith('http') ? photoUrl : `${API_ORIGIN}${photoUrl}`;
  },

  /**
   * Build absolute URL for an employee resume path
   */
  getResumeUrl(resumeUrl) {
    if (!resumeUrl) return null;
    return resumeUrl.startsWith('http') ? resumeUrl : `${API_ORIGIN}${resumeUrl}`;
  },
};

export default employeeService;
