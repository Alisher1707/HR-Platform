import { query } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Departments Service
 * A lightweight, standalone list of department names — independent of
 * employees.department (still free text, no FK). Lets HR create a
 * department (e.g. to prepare an Onboarding plan) before anyone is
 * actually hired into it.
 */

function mapDepartment(row) {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function listDepartments() {
  const result = await query('SELECT * FROM departments ORDER BY name ASC');
  return result.rows.map(mapDepartment);
}

export async function createDepartment(name, userId) {
  const trimmed = name.trim();

  const existing = await query('SELECT id FROM departments WHERE name = $1', [trimmed]);
  if (existing.rows.length > 0) {
    const error = new Error("Bu nomdagi bo'lim allaqachon mavjud");
    error.statusCode = HTTP_STATUS.CONFLICT;
    throw error;
  }

  const result = await query(
    'INSERT INTO departments (name, created_by) VALUES ($1, $2) RETURNING *',
    [trimmed, userId]
  );
  return mapDepartment(result.rows[0]);
}
