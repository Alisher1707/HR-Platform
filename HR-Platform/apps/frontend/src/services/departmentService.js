import api from './api';

/**
 * Departments Service
 * A lightweight, standalone list of department names — used to let HR
 * create a department (e.g. for an Onboarding plan) before anyone is
 * actually hired into it. Independent of employees.department (free text).
 */
export const departmentService = {
  async getDepartments() {
    const response = await api.get('/departments');
    return response.data.data;
  },

  async createDepartment(name) {
    const response = await api.post('/departments', { name });
    return response.data.data;
  },
};

export default departmentService;
