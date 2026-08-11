import api from './api';

/**
 * Fines Service
 * Two related catalogs, both configured from Moliya > Jarimalar:
 *  - fine types ("Jazo turi") — punishments like "Ogohlantirish", created
 *    ad-hoc via "Jazo yaratish".
 *  - fine policies ("Jarima yaratish") — named policies made of
 *    violation -> time limit -> amount -> punishment templates.
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
};

export default fineService;
