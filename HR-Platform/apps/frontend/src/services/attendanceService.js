import api from './api';

/**
 * Attendance Service
 * Handles all davomat (attendance) related API calls
 */

export const attendanceService = {
  /**
   * Get attendance records, optionally scoped to a single day (YYYY-MM-DD)
   * and/or a single employee.
   */
  async getAttendance(params = {}) {
    const response = await api.get('/attendance', { params });
    return response.data.data;
  },

  /**
   * Create a manual attendance record.
   * type: 'keldi' | 'ketdi', recordedAt: ISO datetime string
   */
  async createAttendance(data) {
    const response = await api.post('/attendance', data);
    return response.data.data;
  },

  /**
   * Delete a manual attendance record (device-sourced records can't be deleted here).
   */
  async deleteAttendance(id) {
    const response = await api.delete(`/attendance/${id}`);
    return response.data;
  },

  /**
   * Per-employee attendance summary for a date range — Monitoring > Hisobotlar.
   * branches/departments/positions are arrays; the backend expects comma-joined strings.
   */
  async getReport({ startDate, endDate, branches, departments, positions, scheduleIds, employeeId } = {}) {
    const response = await api.get('/attendance/report', {
      params: {
        startDate,
        endDate,
        branches: branches?.length ? branches.join(',') : undefined,
        departments: departments?.length ? departments.join(',') : undefined,
        positions: positions?.length ? positions.join(',') : undefined,
        scheduleIds: scheduleIds?.length ? scheduleIds.join(',') : undefined,
        employeeId: employeeId || undefined,
      },
    });
    return response.data.data;
  },
};

export default attendanceService;
