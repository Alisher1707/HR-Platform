import { query, getClient } from '../../config/database.js';
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

/**
 * Bo'lim nomini o'zgartiradi — agar nom haqiqatan o'zgargan bo'lsa,
 * employees.department va onboarding_plans.department'dagi eski qiymat
 * ham yangi nomga ko'chiriladi (erkin matn maydonlar, FK yo'q, shuning
 * uchun bu yerda qo'lda sinxronlanadi — aks holda kartalar/rejalar eski
 * nomga "osilib" qolib ketardi).
 */
export async function updateDepartment(id, name) {
  const trimmed = name.trim();
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT name FROM departments WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      const error = new Error('Bo\'lim topilmadi');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    const oldName = current.rows[0].name;

    if (oldName !== trimmed) {
      const dup = await client.query('SELECT id FROM departments WHERE name = $1 AND id <> $2', [trimmed, id]);
      if (dup.rows.length > 0) {
        const error = new Error("Bu nomdagi bo'lim allaqachon mavjud");
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      await client.query('UPDATE employees SET department = $1 WHERE department = $2', [trimmed, oldName]);
      await client.query('UPDATE onboarding_plans SET department = $1 WHERE department = $2', [trimmed, oldName]);
    }

    const result = await client.query(
      'UPDATE departments SET name = $1 WHERE id = $2 RETURNING *',
      [trimmed, id]
    );

    await client.query('COMMIT');
    return mapDepartment(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteDepartment(id) {
  const result = await query('DELETE FROM departments WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    const error = new Error('Bo\'lim topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return { success: true, id };
}
