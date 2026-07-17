import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS, MESSAGES } from '../../config/constants.js';

/**
 * Employees Service
 * Handles employee management business logic
 */

/**
 * Create employee and automatically create application
 */
export async function createEmployee(employeeData, createdBy) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Insert employee with all new fields
    const employeeResult = await client.query(
      `INSERT INTO employees (
        employee_number, first_name, last_name, branch, department, position,
        join_date, birth_date, pnfl, phone, email, address,
        salary_type, salary_amount, status, kpi_template, experience, telegram_username, created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        employeeData.employeeNumber || null,
        employeeData.firstName,
        employeeData.lastName,
        employeeData.branch || null,
        employeeData.department || null,
        employeeData.position || null,
        employeeData.joinDate || null,
        employeeData.birthDate || null,
        employeeData.pnfl || null,
        employeeData.phone || null,
        employeeData.email || null,
        employeeData.address || null,
        employeeData.salaryType || 'Oylik',
        employeeData.salaryAmount || null,
        employeeData.status || 'Faol',
        employeeData.kpiTemplate || null,
        employeeData.experience || 0,
        employeeData.telegramUsername || null,
        createdBy,
      ]
    );

    const employee = employeeResult.rows[0];

    // Automatically create application with status 'KELDI'
    const applicationResult = await client.query(
      `INSERT INTO applications (employee_id, status, position, notes, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        employee.id,
        'KELDI',
        employeeData.position || null,
        employeeData.notes || null,
        0, // Default order
      ]
    );

    const application = applicationResult.rows[0];

    // Log history
    await client.query(
      `INSERT INTO application_history (application_id, changed_by, new_status, comment)
       VALUES ($1, $2, $3, $4)`,
      [application.id, createdBy, 'KELDI', 'Ariza yaratildi']
    );

    await client.query('COMMIT');

    return {
      employee,
      application,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all employees with pagination and filters
 */
export async function getAllEmployees(filters = {}, pagination = {}) {
  // Nomzodlar (havola orqali ariza topshirganlar) Xodimlar bo'limida ko'rinmaydi —
  // ular Kanban doskasida SHARTNOMA bosqichiga o'tgandagina 'Faol' bo'ladi
  let whereClause = [`e.status IS DISTINCT FROM 'Nomzod'`];
  let params = [];
  let paramCount = 1;

  // Build WHERE clause
  if (filters.search) {
    whereClause.push(
      `(e.first_name ILIKE $${paramCount} OR e.last_name ILIKE $${paramCount} OR e.phone ILIKE $${paramCount} OR e.email ILIKE $${paramCount})`
    );
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  if (filters.createdBy) {
    whereClause.push(`e.created_by = $${paramCount}`);
    params.push(filters.createdBy);
    paramCount++;
  }

  const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  // Count total
  const countResult = await query(
    `SELECT COUNT(*) as total FROM employees e ${whereString}`,
    params
  );
  const total = parseInt(countResult.rows[0].total);

  // Get paginated data
  const page = pagination.page || 1;
  const limit = pagination.limit || 10;
  const offset = (page - 1) * limit;

  const sql = `
    SELECT
      e.*,
      u.first_name as creator_first_name,
      u.last_name as creator_last_name,
      u.email as creator_email,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.birth_date))::INTEGER as age
    FROM employees e
    LEFT JOIN users u ON e.created_by = u.id
    ${whereString}
    ORDER BY e.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;

  params.push(limit, offset);

  const result = await query(sql, params);

  return {
    employees: result.rows.map((row) => ({
      id: row.id,
      employee_number: row.employee_number,
      first_name: row.first_name,
      last_name: row.last_name,
      branch: row.branch,
      department: row.department,
      position: row.position,
      join_date: row.join_date,
      birth_date: row.birth_date,
      pnfl: row.pnfl,
      phone: row.phone,
      email: row.email,
      address: row.address,
      salary_type: row.salary_type,
      salary_amount: row.salary_amount ? parseFloat(row.salary_amount) : null,
      status: row.status,
      kpi_template: row.kpi_template,
      telegram_username: row.telegram_username,
      photo_url: row.photo_url,
      resume_url: row.resume_url,
      resume_original_name: row.resume_original_name,
      age: row.age,
      experience: row.experience,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by ? {
        id: row.created_by,
        first_name: row.creator_first_name,
        last_name: row.creator_last_name,
        email: row.creator_email,
      } : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get employee by ID
 */
export async function getEmployeeById(id) {
  const result = await query(
    `SELECT
      e.*,
      u.first_name as creator_first_name,
      u.last_name as creator_last_name,
      u.email as creator_email,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.birth_date))::INTEGER as age
    FROM employees e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    const error = new Error(MESSAGES.EMPLOYEE_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    employee_number: row.employee_number,
    first_name: row.first_name,
    last_name: row.last_name,
    branch: row.branch,
    department: row.department,
    position: row.position,
    join_date: row.join_date,
    birth_date: row.birth_date,
    pnfl: row.pnfl,
    phone: row.phone,
    email: row.email,
    address: row.address,
    salary_type: row.salary_type,
    salary_amount: row.salary_amount ? parseFloat(row.salary_amount) : null,
    status: row.status,
    kpi_template: row.kpi_template,
    telegram_username: row.telegram_username,
    photo_url: row.photo_url,
    resume_url: row.resume_url,
    resume_original_name: row.resume_original_name,
    age: row.age,
    experience: row.experience,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by ? {
      id: row.created_by,
      first_name: row.creator_first_name,
      last_name: row.creator_last_name,
      email: row.creator_email,
    } : null,
  };
}

/**
 * Update employee
 */
export async function updateEmployee(id, updates) {
  const allowedFields = [
    'employee_number', 'first_name', 'last_name', 'branch', 'department', 'position',
    'join_date', 'birth_date', 'pnfl', 'phone', 'email', 'address',
    'salary_type', 'salary_amount', 'status', 'kpi_template', 'experience', 'telegram_username'
  ];
  const setClauses = [];
  const params = [];
  let paramCount = 1;

  // Build SET clause dynamically
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

  // Add updated_at
  setClauses.push(`updated_at = NOW()`);

  // Add ID to params
  params.push(id);

  const sql = `
    UPDATE employees
    SET ${setClauses.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await query(sql, params);

  if (result.rows.length === 0) {
    const error = new Error(MESSAGES.EMPLOYEE_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  return result.rows[0];
}

/**
 * Update employee photo
 * Returns the updated employee row and the previous photo URL (for cleanup)
 */
export async function updateEmployeePhoto(id, photoUrl) {
  const currentResult = await query('SELECT photo_url FROM employees WHERE id = $1', [id]);

  if (currentResult.rows.length === 0) {
    const error = new Error(MESSAGES.EMPLOYEE_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const oldPhotoUrl = currentResult.rows[0].photo_url;

  const result = await query(
    `UPDATE employees
     SET photo_url = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [photoUrl, id]
  );

  return {
    employee: result.rows[0],
    oldPhotoUrl,
  };
}

/**
 * Delete employee (soft delete via application CASCADE)
 */
export async function deleteEmployee(id) {
  const result = await query('DELETE FROM employees WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    const error = new Error(MESSAGES.EMPLOYEE_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  return { id: result.rows[0].id };
}
