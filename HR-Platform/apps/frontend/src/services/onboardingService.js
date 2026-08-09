import api from './api';

// Backend origin (without /api/v1) — used for building document URLs.
const API_ORIGIN = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '');

/**
 * Onboarding Service
 * A plan is a named checklist of steps. Assigning it to an employee mints
 * that employee a unique, unauthenticated public link — the public.* calls
 * below never send an auth header (they're used from a logged-out page).
 */
export const onboardingService = {
  async getPlans() {
    const response = await api.get('/onboarding/plans');
    return response.data.data;
  },

  async getPlanById(id) {
    const response = await api.get(`/onboarding/plans/${id}`);
    return response.data.data;
  },

  async createPlan(plan) {
    const response = await api.post('/onboarding/plans', plan);
    return response.data.data;
  },

  async updatePlan(id, plan) {
    const response = await api.put(`/onboarding/plans/${id}`, plan);
    return response.data.data;
  },

  async deletePlan(id) {
    const response = await api.delete(`/onboarding/plans/${id}`);
    return response.data;
  },

  async getAssignments() {
    const response = await api.get('/onboarding/assignments');
    return response.data.data;
  },

  async createAssignment(planId, employeeId) {
    const response = await api.post('/onboarding/assignments', { planId, employeeId });
    return response.data.data;
  },

  async deleteAssignment(id) {
    const response = await api.delete(`/onboarding/assignments/${id}`);
    return response.data;
  },

  async getPublicAssignment(token) {
    const response = await api.get(`/onboarding/public/${token}`);
    return response.data.data;
  },

  async submitTask(token, taskId, { type, text, link, file }) {
    const formData = new FormData();
    formData.append('type', type);
    if (type === 'text') formData.append('text', text || '');
    if (type === 'link') formData.append('link', link || '');
    if (type === 'file' && file) formData.append('file', file);
    const response = await api.post(`/onboarding/public/${token}/tasks/${taskId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async getAssignmentDetail(id) {
    const response = await api.get(`/onboarding/assignments/${id}`);
    return response.data.data;
  },

  async uploadDocument(file) {
    const formData = new FormData();
    formData.append('document', file);
    const response = await api.post('/onboarding/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async getStats() {
    const response = await api.get('/onboarding/stats');
    return response.data.data;
  },

  getDocumentUrl(documentUrl) {
    if (!documentUrl) return null;
    return documentUrl.startsWith('http') ? documentUrl : `${API_ORIGIN}${documentUrl}`;
  },
};

export default onboardingService;
