import { query } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Payroll Service
 * Employee-facing salary payment ledger ("Ish haqi to'lovlari") — powers
 * Moliya > Ish haqi to'lovlari and the per-employee "To'lov qilish" action
 * on Moliya > Umumiy.
 */

function mapPayment(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    amount: Number(row.amount),
    month: row.month,
    year: row.year,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function listPayments({
  employeeId, branches, departments, positions, scheduleIds, month, year, startDate, endDate,
} = {}) {
  const conditions = [];
  const params = [];

  if (employeeId) {
    params.push(employeeId);
    conditions.push(`sp.employee_id = $${params.length}`);
  }
  if (branches && branches.length) {
    params.push(branches);
    conditions.push(`e.branch = ANY($${params.length})`);
  }
  if (departments && departments.length) {
    params.push(departments);
    conditions.push(`e.department = ANY($${params.length})`);
  }
  if (positions && positions.length) {
    params.push(positions);
    conditions.push(`e.position = ANY($${params.length})`);
  }
  if (scheduleIds && scheduleIds.length) {
    params.push(scheduleIds);
    conditions.push(`EXISTS (
      SELECT 1 FROM work_schedule_employees wse
      WHERE wse.employee_id = sp.employee_id AND wse.schedule_id = ANY($${params.length})
    )`);
  }
  if (month) {
    params.push(month);
    conditions.push(`sp.month = $${params.length}`);
  }
  if (year) {
    params.push(year);
    conditions.push(`sp.year = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    conditions.push(`sp.created_at::date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`sp.created_at::date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT sp.*
     FROM salary_payments sp
     JOIN employees e ON e.id = sp.employee_id
     ${where}
     ORDER BY sp.created_at DESC`,
    params
  );

  return result.rows.map(mapPayment);
}

export async function createPayment({ employeeId, amount, month, year, note, createdBy }) {
  const employeeCheck = await query('SELECT id FROM employees WHERE id = $1', [employeeId]);
  if (employeeCheck.rows.length === 0) {
    const error = new Error('Xodim topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const result = await query(
    `INSERT INTO salary_payments (employee_id, amount, month, year, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [employeeId, amount, month, year, note || null, createdBy]
  );

  return mapPayment(result.rows[0]);
}

export async function deletePayment(id) {
  const result = await query('DELETE FROM salary_payments WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    const error = new Error("To'lov topilmadi");
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return { success: true, id };
}
