import api from './api';

// Backend origin (without /api/v1) — used for building fine evidence file URLs.
const API_ORIGIN = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '');

/**
 * Fines Service
 * Two related catalogs, both configured from Moliya > Jarimalar:
 *  - fine types ("Jazo turi") — punishments like "Ogohlantirish", created
 *    ad-hoc via "Jazo yaratish".
 *  - fine policies ("Jarima yaratish") — named policies made of
 *    violation -> time limit -> amount -> punishment templates.
 *  - assigned fines ("Tayinlangan jarimalar ro'yxati") — a real charge
 *    against a specific employee, optionally with an evidence file.
 */
export const fineService = {
  async getFineTypes() {
    const response = await api.get('/fines/types');
    return response.data.data;
  },

  async createFineType(name) {
    const response = await api.post('/fines/types', { name });
    return response.data.data;
  },

  async deleteFineType(id) {
    const response = await api.delete(`/fines/types/${id}`);
    return response.data;
  },

  async getFinePolicies() {
    const response = await api.get('/fines/policies');
    return response.data.data;
  },

  async getFinePolicyById(id) {
    const response = await api.get(`/fines/policies/${id}`);
    return response.data.data;
  },

  async createFinePolicy(policy) {
    const response = await api.post('/fines/policies', policy);
    return response.data.data;
  },

  async updateFinePolicy(id, policy) {
    const response = await api.put(`/fines/policies/${id}`, policy);
    return response.data.data;
  },

  async deleteFinePolicy(id) {
    const response = await api.delete(`/fines/policies/${id}`);
    return response.data;
  },

  async getAssignedFines({ employeeId, branches, departments, positions, scheduleIds, startDate, endDate } = {}) {
    const response = await api.get('/fines/assigned', {
      params: {
        employeeId: employeeId || undefined,
        branches: branches?.length ? branches.join(',') : undefined,
        departments: departments?.length ? departments.join(',') : undefined,
        positions: positions?.length ? positions.join(',') : undefined,
        scheduleIds: scheduleIds?.length ? scheduleIds.join(',') : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      },
    });
    return response.data.data;
  },

  async createAssignedFine({ employeeId, amount, fineTypeId, note, file }) {
    const formData = new FormData();
    formData.append('employeeId', employeeId);
    formData.append('amount', amount);
    if (fineTypeId) formData.append('fineTypeId', fineTypeId);
    if (note) formData.append('note', note);
    if (file) formData.append('file', file);
    const response = await api.post('/fines/assigned', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async deleteAssignedFine(id) {
    const response = await api.delete(`/fines/assigned/${id}`);
    return response.data;
  },

  async updatePunishmentStatus(id, { status, note }) {
    const response = await api.patch(`/fines/assigned/${id}/punishment`, { status, note });
    return response.data.data;
  },

  /**
   * Build absolute URL for an assigned fine's evidence file
   */
  getFileUrl(fileUrl) {
    if (!fileUrl) return null;
    return fileUrl.startsWith('http') ? fileUrl : `${API_ORIGIN}${fileUrl}`;
  },
};

export default fineService;
