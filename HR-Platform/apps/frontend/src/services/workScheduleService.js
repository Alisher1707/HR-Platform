import api from './api';

/**
 * Work Schedule Service
 * Handles all "Ish jadvallari" (work schedule) related API calls —
 * schedules are created and assigned to one or more employees at once;
 * Davomat (attendance) recording reads the assignment to flag late arrivals.
 */

export const workScheduleService = {
  async getSchedules() {
    const response = await api.get('/schedules');
    return response.data.data;
  },

  async getScheduleById(id) {
    const response = await api.get(`/schedules/${id}`);
    return response.data.data;
  },

  async createSchedule(data) {
    const response = await api.post('/schedules', data);
    return response.data.data;
  },

  async updateSchedule(id, data) {
    const response = await api.put(`/schedules/${id}`, data);
    return response.data.data;
  },

  async deleteSchedule(id) {
    const response = await api.delete(`/schedules/${id}`);
    return response.data;
  },
};

export default workScheduleService;
