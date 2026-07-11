import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';
import fs from 'fs/promises';

/**
 * EJM Service
 * Employee Journey Map management
 */

/**
 * Get user's EJM data
 */
export async function getUserEJM(userId) {
  const result = await query(
    'SELECT * FROM ejm_data WHERE user_id = $1 AND employee_id IS NULL ORDER BY updated_at DESC LIMIT 1',
    [userId]
  );

  if (result.rows.length > 0) {
    return {
      id: result.rows[0].id,
      data: result.rows[0].data_json,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
  }

  return null;
}

/**
 * Get employee's EJM data (employee-specific)
 */
export async function getEmployeeEJM(employeeId) {
  const result = await query(
    'SELECT * FROM ejm_data WHERE employee_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [employeeId]
  );

  if (result.rows.length > 0) {
    return {
      id: result.rows[0].id,
      data: result.rows[0].data_json,
      employeeId: result.rows[0].employee_id,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
  }

  return null;
}

/**
 * Save or update user's EJM data
 */
export async function saveUserEJM(userId, ejmData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check if user already has EJM
    const existing = await client.query(
      'SELECT id FROM ejm_data WHERE user_id = $1',
      [userId]
    );

    let ejmId;

    if (existing.rows.length > 0) {
      // Update existing
      const result = await client.query(
        `UPDATE ejm_data
         SET data_json = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id`,
        [ejmData, existing.rows[0].id]
      );
      ejmId = result.rows[0].id;
    } else {
      // Create new
      const result = await client.query(
        `INSERT INTO ejm_data (user_id, data_json)
         VALUES ($1, $2)
         RETURNING id`,
        [userId, ejmData]
      );
      ejmId = result.rows[0].id;
    }

    await client.query('COMMIT');

    return { id: ejmId, data: ejmData };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Upload files to EJM node
 */
export async function uploadEJMFiles(userId, phaseIndex, nodeIndex, files, employeeId = null) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get or create user's/employee's EJM
    let ejmResult;
    if (employeeId) {
      ejmResult = await client.query(
        'SELECT id FROM ejm_data WHERE employee_id = $1',
        [employeeId]
      );
    } else {
      ejmResult = await client.query(
        'SELECT id FROM ejm_data WHERE user_id = $1 AND employee_id IS NULL',
        [userId]
      );
    }

    let ejmId;

    if (ejmResult.rows.length === 0) {
      // Create empty EJM if doesn't exist
      const newEjm = await client.query(
        'INSERT INTO ejm_data (user_id, employee_id, data_json) VALUES ($1, $2, $3) RETURNING id',
        [userId, employeeId, { phases: [] }]
      );
      ejmId = newEjm.rows[0].id;
    } else {
      ejmId = ejmResult.rows[0].id;
    }

    // Save each file
    const savedFiles = [];
    for (const file of files) {
      const result = await client.query(
        `INSERT INTO ejm_files
         (ejm_data_id, phase_index, node_index, file_name, file_size, file_type, file_path, original_name, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          ejmId,
          phaseIndex,
          nodeIndex,
          file.filename,
          file.size,
          file.mimetype,
          file.path,
          file.originalname,
          userId
        ]
      );
      savedFiles.push(result.rows[0]);
    }

    await client.query('COMMIT');

    return savedFiles.map(f => ({
      id: f.id,
      name: f.original_name,
      fileName: f.file_name,
      size: f.file_size,
      type: f.file_type,
      createdAt: f.created_at
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get files for specific node
 */
export async function getNodeFiles(userId, phaseIndex, nodeIndex, employeeId = null) {
  let result;
  if (employeeId) {
    result = await query(
      `SELECT f.id, f.file_name, f.file_size, f.file_type, f.original_name, f.created_at
       FROM ejm_files f
       JOIN ejm_data e ON f.ejm_data_id = e.id
       WHERE e.employee_id = $1 AND f.phase_index = $2 AND f.node_index = $3
       ORDER BY f.created_at DESC`,
      [employeeId, phaseIndex, nodeIndex]
    );
  } else {
    result = await query(
      `SELECT f.id, f.file_name, f.file_size, f.file_type, f.original_name, f.created_at
       FROM ejm_files f
       JOIN ejm_data e ON f.ejm_data_id = e.id
       WHERE e.user_id = $1 AND e.employee_id IS NULL AND f.phase_index = $2 AND f.node_index = $3
       ORDER BY f.created_at DESC`,
      [userId, phaseIndex, nodeIndex]
    );
  }

  return result.rows.map(f => ({
    id: f.id,
    name: f.original_name,
    fileName: f.file_name,
    size: f.file_size,
    type: f.file_type,
    createdAt: f.created_at
  }));
}

/**
 * Delete file
 */
export async function deleteEJMFile(fileId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get file info and verify ownership
    const fileResult = await client.query(
      `SELECT f.*, e.user_id
       FROM ejm_files f
       JOIN ejm_data e ON f.ejm_data_id = e.id
       WHERE f.id = $1`,
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      const error = new Error('Fayl topilmadi');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    const fileData = fileResult.rows[0];

    if (fileData.user_id !== userId) {
      const error = new Error('Ruxsat yo\'q');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }

    // Delete file from filesystem
    try {
      await fs.unlink(fileData.file_path);
    } catch (err) {
      console.error('Failed to delete file from filesystem:', err);
      // Continue anyway to remove DB record
    }

    // Delete from database
    await client.query('DELETE FROM ejm_files WHERE id = $1', [fileId]);

    await client.query('COMMIT');

    return { success: true, id: fileId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Download file
 */
export async function getEJMFile(fileId, userId) {
  const result = await query(
    `SELECT f.*, e.user_id
     FROM ejm_files f
     JOIN ejm_data e ON f.ejm_data_id = e.id
     WHERE f.id = $1`,
    [fileId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Fayl topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const fileData = result.rows[0];

  if (fileData.user_id !== userId) {
    const error = new Error('Ruxsat yo\'q');
    error.statusCode = HTTP_STATUS.FORBIDDEN;
    throw error;
  }

  return {
    path: fileData.file_path,
    name: fileData.original_name,
    type: fileData.file_type
  };
}
