import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS, MESSAGES, APPLICATION_STATUS } from '../../config/constants.js';

/**
 * Applications Service
 * Handles Kanban board business logic
 */

/**
 * Get all applications grouped by status (for Kanban board)
 */
export async function getAllApplications(filters = {}) {
  let whereClause = [];
  let params = [];
  let paramCount = 1;

  // Build WHERE clause
  if (filters.status) {
    whereClause.push(`a.status = $${paramCount}`);
    params.push(filters.status);
    paramCount++;
  }

  if (filters.assignedTo) {
    whereClause.push(`a.assigned_to = $${paramCount}`);
    params.push(filters.assignedTo);
    paramCount++;
  }

  if (filters.search) {
    whereClause.push(
      `(e.first_name ILIKE $${paramCount} OR e.last_name ILIKE $${paramCount} OR a.position ILIKE $${paramCount})`
    );
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  const sql = `
    SELECT
      a.*,
      e.first_name as employee_first_name,
      e.last_name as employee_last_name,
      e.employee_number as employee_employee_number,
      e.phone as employee_phone,
      e.email as employee_email,
      e.address as employee_address,
      e.birth_date as employee_birth_date,
      e.join_date as employee_join_date,
      e.pnfl as employee_pnfl,
      e.branch as employee_branch,
      e.department as employee_department,
      e.position as employee_position,
      e.salary_type as employee_salary_type,
      e.salary_amount as employee_salary_amount,
      e.status as employee_status,
      e.kpi_template as employee_kpi_template,
      e.telegram_username as employee_telegram_username,
      e.experience as employee_experience,
      u.first_name as assigned_first_name,
      u.last_name as assigned_last_name,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.birth_date))::INTEGER as employee_age
    FROM applications a
    INNER JOIN employees e ON a.employee_id = e.id
    LEFT JOIN users u ON a.assigned_to = u.id
    ${whereString}
    ORDER BY a.status, a.order_index ASC, a.created_at DESC
  `;

  const result = await query(sql, params);

  // Group by status for Kanban board
  const grouped = {
    [APPLICATION_STATUS.KELDI]: [],
    [APPLICATION_STATUS.QOSHILDI]: [],
    [APPLICATION_STATUS.SINOV_MUDDATI]: [],
    [APPLICATION_STATUS.SHARTNOMA]: [],
    [APPLICATION_STATUS.RAD_ETILDI]: [],
  };

  result.rows.forEach((row) => {
    grouped[row.status].push({
      id: row.id,
      status: row.status,
      position: row.position,
      notes: row.notes,
      order_index: row.order_index,
      created_at: row.created_at,
      updated_at: row.updated_at,
      employee: {
        id: row.employee_id,
        first_name: row.employee_first_name,
        last_name: row.employee_last_name,
        employee_number: row.employee_employee_number,
        phone: row.employee_phone,
        email: row.employee_email,
        address: row.employee_address,
        birth_date: row.employee_birth_date,
        join_date: row.employee_join_date,
        pnfl: row.employee_pnfl,
        branch: row.employee_branch,
        department: row.employee_department,
        position: row.employee_position,
        salary_type: row.employee_salary_type,
        salary_amount: row.employee_salary_amount ? parseFloat(row.employee_salary_amount) : null,
        status: row.employee_status,
        kpi_template: row.employee_kpi_template,
        telegram_username: row.employee_telegram_username,
        age: row.employee_age,
        experience: row.employee_experience,
      },
      assigned_to: row.assigned_to ? {
        id: row.assigned_to,
        first_name: row.assigned_first_name,
        last_name: row.assigned_last_name,
      } : null,
    });
  });

  return grouped;
}

/**
 * Get application by ID
 */
export async function getApplicationById(id) {
  const result = await query(
    `SELECT
      a.*,
      e.first_name as employee_first_name,
      e.last_name as employee_last_name,
      e.employee_number as employee_employee_number,
      e.phone as employee_phone,
      e.email as employee_email,
      e.address as employee_address,
      e.birth_date as employee_birth_date,
      e.join_date as employee_join_date,
      e.pnfl as employee_pnfl,
      e.branch as employee_branch,
      e.department as employee_department,
      e.position as employee_position,
      e.salary_type as employee_salary_type,
      e.salary_amount as employee_salary_amount,
      e.status as employee_status,
      e.kpi_template as employee_kpi_template,
      e.telegram_username as employee_telegram_username,
      e.experience as employee_experience,
      u.first_name as assigned_first_name,
      u.last_name as assigned_last_name,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.birth_date))::INTEGER as employee_age
    FROM applications a
    INNER JOIN employees e ON a.employee_id = e.id
    LEFT JOIN users u ON a.assigned_to = u.id
    WHERE a.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    const error = new Error(MESSAGES.APPLICATION_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    status: row.status,
    position: row.position,
    notes: row.notes,
    order_index: row.order_index,
    created_at: row.created_at,
    updated_at: row.updated_at,
    employee: {
      id: row.employee_id,
      first_name: row.employee_first_name,
      last_name: row.employee_last_name,
      employee_number: row.employee_employee_number,
      phone: row.employee_phone,
      email: row.employee_email,
      address: row.employee_address,
      birth_date: row.employee_birth_date,
      join_date: row.employee_join_date,
      pnfl: row.employee_pnfl,
      branch: row.employee_branch,
      department: row.employee_department,
      position: row.employee_position,
      salary_type: row.employee_salary_type,
      salary_amount: row.employee_salary_amount ? parseFloat(row.employee_salary_amount) : null,
      status: row.employee_status,
      kpi_template: row.employee_kpi_template,
      telegram_username: row.employee_telegram_username,
      age: row.employee_age,
      experience: row.employee_experience,
    },
    assigned_to: row.assigned_to ? {
      id: row.assigned_to,
      first_name: row.assigned_first_name,
      last_name: row.assigned_last_name,
    } : null,
  };
}

/**
 * Update application status (Drag & Drop between columns)
 */
export async function updateApplicationStatus(id, newStatus, changedBy, comment = null) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get current application
    const currentResult = await client.query(
      'SELECT id, status, order_index FROM applications WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      const error = new Error(MESSAGES.APPLICATION_NOT_FOUND);
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    const oldStatus = currentResult.rows[0].status;

    // Get max order_index in new status column
    const maxOrderResult = await client.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 as new_order FROM applications WHERE status = $1',
      [newStatus]
    );

    const newOrderIndex = maxOrderResult.rows[0].new_order;

    // If moving to SHARTNOMA, set start date for 1-hour timer before becoming employee
    let updateQuery = '';
    let updateParams = [];

    if (newStatus === APPLICATION_STATUS.SHARTNOMA) {
      updateQuery = `UPDATE applications
       SET status = $1, order_index = $2, shartnoma_start_date = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`;
      updateParams = [newStatus, newOrderIndex, id];
    } else {
      // Reset shartnoma_start_date if moving away from SHARTNOMA
      updateQuery = `UPDATE applications
       SET status = $1, order_index = $2, shartnoma_start_date = NULL, updated_at = NOW()
       WHERE id = $3
       RETURNING *`;
      updateParams = [newStatus, newOrderIndex, id];
    }

    // Update application
    const updateResult = await client.query(updateQuery, updateParams);
    const application = updateResult.rows[0];

    // If moving to SHARTNOMA, update employee record with complete information
    if (newStatus === APPLICATION_STATUS.SHARTNOMA) {
      // Get application details including position
      const appDetailsResult = await client.query(
        'SELECT employee_id, position FROM applications WHERE id = $1',
        [id]
      );

      if (appDetailsResult.rows.length > 0) {
        const employeeId = appDetailsResult.rows[0].employee_id;
        const position = appDetailsResult.rows[0].position;

        // Update employee with complete hiring information
        await client.query(
          `UPDATE employees
           SET position = $1,
               join_date = CURRENT_DATE,
               status = 'Faol',
               updated_at = NOW()
           WHERE id = $2`,
          [position, employeeId]
        );
      }
    }

    // Log history
    await client.query(
      `INSERT INTO application_history (application_id, changed_by, old_status, new_status, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, changedBy, oldStatus, newStatus, comment || `Status o'zgartirildi: ${oldStatus} → ${newStatus}`]
    );

    await client.query('COMMIT');

    return application;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update application order (Drag & Drop within same column)
 */
export async function updateApplicationOrder(id, newOrderIndex) {
  const result = await query(
    `UPDATE applications
     SET order_index = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [newOrderIndex, id]
  );

  if (result.rows.length === 0) {
    const error = new Error(MESSAGES.APPLICATION_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  return result.rows[0];
}

/**
 * Update application details
 */
export async function updateApplication(id, updates, changedBy) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const allowedFields = ['position', 'notes', 'assigned_to'];
    const setClauses = [];
    const params = [];
    let paramCount = 1;

    // Build SET clause
    Object.keys(updates).forEach((key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        setClauses.push(`${snakeKey} = $${paramCount}`);
        params.push(updates[key]);
        paramCount++;
      }
    });

    if (setClauses.length === 0) {
      const error = new Error('No valid fields to update');
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE applications
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await client.query(sql, params);

    if (result.rows.length === 0) {
      const error = new Error(MESSAGES.APPLICATION_NOT_FOUND);
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    // Log history
    await client.query(
      `INSERT INTO application_history (application_id, changed_by, comment)
       VALUES ($1, $2, $3)`,
      [id, changedBy, 'Ma\'lumotlar yangilandi']
    );

    await client.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get application history
 */
export async function getApplicationHistory(applicationId) {
  const result = await query(
    `SELECT
      ah.*,
      u.first_name as changed_by_first_name,
      u.last_name as changed_by_last_name
    FROM application_history ah
    LEFT JOIN users u ON ah.changed_by = u.id
    WHERE ah.application_id = $1
    ORDER BY ah.changed_at DESC`,
    [applicationId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    old_status: row.old_status,
    new_status: row.new_status,
    comment: row.comment,
    changed_at: row.changed_at,
    changed_by: row.changed_by ? {
      id: row.changed_by,
      first_name: row.changed_by_first_name,
      last_name: row.changed_by_last_name,
    } : null,
  }));
}
