import api from './api';

/**
 * Employee Service
 * Handles all employee-related API calls
 */

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
};

export default employeeService;
