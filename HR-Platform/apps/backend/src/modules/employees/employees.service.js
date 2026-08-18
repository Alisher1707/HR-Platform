import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS, MESSAGES } from '../../config/constants.js';
import { generateLinkCode } from '../../shared/utils/crypto.js';

/**
 * Employees Service
 * Handles employee management business logic
 */

/**
 * Next auto-numbered person_id (kamera Employee ID), drawn from a single
 * database sequence shared by every place that can create an employee row
 * (direct create, invite registration, candidate application) — see
 * migrations/024_add_person_id_sequence.sql. A sequence is atomic, so
 * concurrent creates can never be handed the same number.
 */
export async function getNextAutoPersonId(client) {
  const result = await client.query(`SELECT nextval('employees_person_id_seq') AS next_id`);
  return String(result.rows[0].next_id);
}

/**
 * Create employee and automatically create a matching "Shartnoma imzolandi"
 * application row, so they show up on the Lead kanban as an already-hired
 * record rather than a fresh candidate application.
 */
export async function createEmployee(employeeData, createdBy) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Person ID (kamera/yuz-tanish identifikatori) is system-managed —
    // always auto-assigned, never accepted from the caller, so it can never
    // be typed in wrong or collide with what's actually on the device.
    const personId = await getNextAutoPersonId(client);

    // Insert employee with all new fields
    let employeeResult;
    try {
      employeeResult = await client.query(
        `INSERT INTO employees (
          employee_number, first_name, last_name, branch, department, position,
          join_date, birth_date, pnfl, phone, email, address,
          salary_type, salary_amount, status, kpi_template, experience, telegram_username,
          contract_start_date, contract_end_date, person_id, created_by
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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
          employeeData.contractStartDate || null,
          employeeData.contractEndDate || null,
          personId,
          createdBy,
        ]
      );
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'idx_employees_person_id') {
        const error = new Error('Bu Person ID allaqachon boshqa xodimga biriktirilgan');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }
      throw err;
    }

    const employee = employeeResult.rows[0];

    // Xodimlar bo'limidan qo'lda qo'shilgan xodim allaqachon ishga qabul
    // qilingan hisoblanadi — Lead kanbanida yangi ariza ("KELDI") emas,
    // to'g'ridan-to'g'ri "Shartnoma imzolandi" ustunida qisqa muddat
    // ko'rinadi. shartnoma_start_date shu yerda ham (organik nomzodlar
    // kabi) belgilanadi, shunda avtomatik promotsiya jobi bir soatdan so'ng
    // bu yozuvni ham tozalaydi — aks holda (avvalgi xatti-harakat) bu qator
    // Lead doskasida abadiy osilib qolardi, chunki hech narsa uni olib
    // tashlamasdi.
    const applicationResult = await client.query(
      `INSERT INTO applications (employee_id, status, position, notes, order_index, shartnoma_start_date)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        employee.id,
        'SHARTNOMA',
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
      [application.id, createdBy, 'SHARTNOMA', 'Xodim to\'g\'ridan-to\'g\'ri qo\'shildi']
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
    ORDER BY
      CASE WHEN e.contract_end_date IS NOT NULL
             AND e.contract_end_date <= CURRENT_DATE + INTERVAL '2 months'
           THEN 0 ELSE 1 END,
      CASE WHEN e.contract_end_date IS NOT NULL
             AND e.contract_end_date <= CURRENT_DATE + INTERVAL '2 months'
           THEN e.contract_end_date END ASC,
      e.created_at DESC
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
      telegram_chat_id: row.telegram_chat_id,
      photo_url: row.photo_url,
      resume_url: row.resume_url,
      resume_original_name: row.resume_original_name,
      age: row.age,
      experience: row.experience,
      contract_start_date: row.contract_start_date,
      contract_end_date: row.contract_end_date,
      person_id: row.person_id,
      current_presence: row.current_presence,
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
    telegram_chat_id: row.telegram_chat_id,
    photo_url: row.photo_url,
    resume_url: row.resume_url,
    resume_original_name: row.resume_original_name,
    age: row.age,
    experience: row.experience,
    contract_start_date: row.contract_start_date,
    contract_end_date: row.contract_end_date,
    person_id: row.person_id,
    current_presence: row.current_presence,
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
  // person_id is intentionally excluded — it's system-managed (auto-assigned
  // at creation only) and can never be edited afterwards.
  const allowedFields = [
    'employee_number', 'first_name', 'last_name', 'branch', 'department', 'position',
    'join_date', 'birth_date', 'pnfl', 'phone', 'email', 'address',
    'salary_type', 'salary_amount', 'status', 'kpi_template', 'experience', 'telegram_username',
    'contract_start_date', 'contract_end_date'
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

  let result;
  try {
    result = await query(sql, params);
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'idx_employees_person_id') {
      const error = new Error('Bu Person ID allaqachon boshqa xodimga biriktirilgan');
      error.statusCode = HTTP_STATUS.CONFLICT;
      throw error;
    }
    throw err;
  }

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
 * Update employee resume
 * Returns the updated employee row and the previous resume URL (for cleanup)
 */
export async function updateEmployeeResume(id, resumeUrl, resumeOriginalName) {
  const currentResult = await query('SELECT resume_url FROM employees WHERE id = $1', [id]);

  if (currentResult.rows.length === 0) {
    const error = new Error(MESSAGES.EMPLOYEE_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const oldResumeUrl = currentResult.rows[0].resume_url;

  const result = await query(
    `UPDATE employees
     SET resume_url = $1, resume_original_name = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [resumeUrl, resumeOriginalName, id]
  );

  return {
    employee: result.rows[0],
    oldResumeUrl,
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

/**
 * Generates a fresh one-time code HR gives the employee to link their
 * Telegram account (deep link `t.me/<bot>?start=<code>`) — the bot swaps it
 * for a permanent telegram_chat_id on first contact. Regenerating overwrites
 * any previous unused code for this employee.
 */
export async function generateTelegramLinkCode(id) {
  const employeeCheck = await query('SELECT id FROM employees WHERE id = $1', [id]);
  if (employeeCheck.rows.length === 0) {
    const error = new Error(MESSAGES.EMPLOYEE_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  // Collisions are extremely unlikely (32^6 possibilities) but trivial to
  // guard against — just retry with a fresh code on the rare unique clash.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateLinkCode();
    try {
      await query('UPDATE employees SET telegram_link_code = $1 WHERE id = $2', [code, id]);
      return { code };
    } catch (err) {
      if (err.code !== '23505') throw err; // not a unique-violation — rethrow
    }
  }

  const error = new Error("Bog'lash kodini yaratib bo'lmadi, qayta urinib ko'ring");
  error.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  throw error;
}
