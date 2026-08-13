import api from './api';

/**
 * Payroll Service
 * Employee-facing salary payment ledger ("Ish haqi to'lovlari") — powers
 * Moliya > Ish haqi to'lovlari and the per-employee "To'lov qilish" action
 * on Moliya > Umumiy.
 */
export const payrollService = {
  async getPayments({ employeeId, branches, departments, positions, scheduleIds, month, year, startDate, endDate } = {}) {
    const response = await api.get('/payroll/payments', {
      params: {
        employeeId: employeeId || undefined,
        branches: branches?.length ? branches.join(',') : undefined,
        departments: departments?.length ? departments.join(',') : undefined,
        positions: positions?.length ? positions.join(',') : undefined,
        scheduleIds: scheduleIds?.length ? scheduleIds.join(',') : undefined,
        month: month || undefined,
        year: year || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      },
    });
    return response.data.data;
  },

  async createPayment({ employeeId, amount, month, year, note }) {
    const response = await api.post('/payroll/payments', { employeeId, amount, month, year, note });
    return response.data.data;
  },

  async deletePayment(id) {
    const response = await api.delete(`/payroll/payments/${id}`);
    return response.data;
  },
};

export default payrollService;
