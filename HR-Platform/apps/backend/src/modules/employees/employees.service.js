import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS, MESSAGES } from '../../config/constants.js';
import { generateLinkCode } from '../../shared/utils/crypto.js';

const TELEGRAM_LINK_CODE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

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
    // XAVFSIZLIK-AUDIT.md (6-pass, amaliy funksional audit, #F2/F3):
    // ommaviy import (bulkImportEmployees, pastda) PNFL/telefon
    // dublikatini har doim tekshirgan - bitta xodim qo'shish esa hech
    // qachon tekshirmagan edi. Jonli sinovda tasdiqlandi: bir xil PNFL
    // bilan ikkita alohida xodim yozuvi muammosiz yaratilardi. Mavjud
    // (demo) ma'lumotlarda allaqachon dublikat borligi sababli DB
    // darajasidagi UNIQUE indeks qo'yib bo'lmadi (migratsiya eski
    // qatorlarga qarab muvaffaqiyatsiz bo'lardi) - shuning uchun bulk-
    // import bilan bir xil, servis darajasidagi tekshiruv qo'llanildi.
    // Faqat FAOL (deleted_at IS NULL) xodimlar orasida - arxivlangan
    // xodimning eski PNFL'i qayta ishga qabul qilinganda to'sqinlik
    // qilmasligi kerak (migratsiya 060).
    if (employeeData.pnfl) {
      const dupe = await client.query(
        'SELECT id FROM employees WHERE pnfl = $1 AND deleted_at IS NULL',
        [employeeData.pnfl]
      );
      if (dupe.rows.length > 0) {
        const error = new Error('Bu JSHSHIR (PNFL) bilan xodim allaqachon mavjud');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }
    }
    if (employeeData.phone) {
      const dupe = await client.query(
        'SELECT id FROM employees WHERE phone = $1 AND deleted_at IS NULL',
        [employeeData.phone]
      );
      if (dupe.rows.length > 0) {
        const error = new Error('Bu telefon raqami bilan xodim allaqachon mavjud');
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }
    }

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
 * Ommaviy import — Excel'dan kelgan xodimlar ro'yxatini bazaga yozadi.
 *
 * `createEmployee`dan ikkita muhim farqi bor:
 *
 *  1. Kanban'ga ariza yozuvi YARATILMAYDI. Qo'lda qo'shilgan xodim "yangi
 *     ishga olindi" hisoblanadi va Lead doskasida bir soat ko'rinadi. Import
 *     esa boshqa narsa — bu allaqachon ishlab turgan jamoani tizimga
 *     ko'chirish. 200 nafar xodim uchun 200 ta karta yaratilsa, doska bir
 *     soatga ishlatib bo'lmas holga kelardi.
 *
 *  2. Har bir qator ALOHIDA tranzaksiyada yoziladi. Bitta noto'g'ri qator
 *     butun importni bekor qilmasligi kerak — foydalanuvchi to'g'ri
 *     qatorlarni oladi va faqat xatolarini tuzatib qayta yuklaydi.
 *
 * Takrorlanishni tekshirish ikki bosqichli:
 *   1. JSHSHIR (pnfl) — O'zbekistonda xodimning tabiiy yagona identifikatori.
 *   2. JSHSHIR bo'sh bo'lsa — telefon raqami bo'yicha.
 *
 * Ikkinchi bosqich zarur, chunki HR fayllarida JSHSHIR ko'pincha
 * to'ldirilmagan bo'ladi. Faqat JSHSHIR bilan tekshirilganda bunday xodim
 * har bir qayta importda yangidan qo'shilaverar edi — ya'ni foydalanuvchi
 * faylni tuzatib qayta yuklasa, ikkinchi nusxalar paydo bo'lardi.
 * Ism-familiya bo'yicha tekshirmaymiz: bir xil ismli ikki xodim mutlaqo
 * normal holat, ularni birlashtirib yuborish esa haqiqiy ma'lumot yo'qotish.
 */
export async function bulkImportEmployees(rows, createdBy) {
  const results = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    // rowNumber — foydalanuvchi Excel'da ko'radigan qator raqami (1-qator
    // sarlavha), shuning uchun xato xabari "5-qator" desa, u faylda aynan
    // 5-qatorni ochadi.
    const rowNumber = row.rowNumber || i + 2;

    try {
      let duplicateReason = null;
      if (row.pnfl) {
        const dupe = await query('SELECT id FROM employees WHERE pnfl = $1', [row.pnfl]);
        if (dupe.rows.length > 0) duplicateReason = 'Bu JSHSHIR bilan xodim allaqachon mavjud';
      } else if (row.phone) {
        const dupe = await query('SELECT id FROM employees WHERE phone = $1', [row.phone]);
        if (dupe.rows.length > 0) duplicateReason = 'Bu telefon raqami bilan xodim allaqachon mavjud';
      }

      if (duplicateReason) {
        skipped += 1;
        results.push({
          rowNumber,
          name: `${row.firstName} ${row.lastName}`,
          status: 'skipped',
          message: duplicateReason,
        });
        continue;
      }

      const client = await getClient();
      try {
        await client.query('BEGIN');
        const personId = await getNextAutoPersonId(client);

        await client.query(
          `INSERT INTO employees (
            employee_number, first_name, last_name, branch, department, position,
            join_date, birth_date, pnfl, phone, email, address,
            salary_type, salary_amount, status, experience, telegram_username,
            contract_start_date, contract_end_date, person_id, created_by
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [
            row.employeeNumber || null,
            row.firstName,
            row.lastName,
            row.branch || null,
            row.department || null,
            row.position || null,
            row.joinDate || null,
            row.birthDate || null,
            row.pnfl || null,
            row.phone || null,
            row.email || null,
            row.address || null,
            row.salaryType || 'Oylik',
            row.salaryAmount != null ? row.salaryAmount : null,
            row.status || 'Faol',
            row.experience || 0,
            row.telegramUsername || null,
            row.contractStartDate || null,
            row.contractEndDate || null,
            personId,
            createdBy,
          ]
        );

        await client.query('COMMIT');
        imported += 1;
        results.push({
          rowNumber,
          name: `${row.firstName} ${row.lastName}`,
          status: 'imported',
          personId,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      failed += 1;
      results.push({
        rowNumber,
        name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || '—',
        status: 'failed',
        message: err.code === '23505'
          ? 'Bunday yozuv allaqachon mavjud (takrorlanuvchi qiymat)'
          : err.message || 'Nomaʼlum xatolik',
      });
    }
  }

  return { imported, skipped, failed, total: rows.length, results };
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

  // Arxivlangan (deleted_at) xodimlar faol ro'yxatda ko'rinmaydi —
  // migratsiya 060 / XAVFSIZLIK-AUDIT.md (2-pass #4). Tarixiy hisobotlar
  // (davomat, jarima, maosh) ataylab filtrlanmaydi: o'sha yozuvlar
  // haqiqatan sodir bo'lgan va xodim nomi ular uchun hali ham kerak.
  whereClause.push('e.deleted_at IS NULL');

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
    WHERE e.id = $1 AND e.deleted_at IS NULL`,
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
  // XAVFSIZLIK-AUDIT.md (6-pass, amaliy funksional audit, #F2/F3):
  // createEmployee bilan bir xil bo'shliq — xodimni tahrirlab, uni
  // boshqa faol xodimning PNFL/telefoniga o'zgartirib bo'lardi.
  if (updates.pnfl) {
    const dupe = await query(
      'SELECT id FROM employees WHERE pnfl = $1 AND deleted_at IS NULL AND id <> $2',
      [updates.pnfl, id]
    );
    if (dupe.rows.length > 0) {
      const error = new Error('Bu JSHSHIR (PNFL) bilan xodim allaqachon mavjud');
      error.statusCode = HTTP_STATUS.CONFLICT;
      throw error;
    }
  }
  if (updates.phone) {
    const dupe = await query(
      'SELECT id FROM employees WHERE phone = $1 AND deleted_at IS NULL AND id <> $2',
      [updates.phone, id]
    );
    if (dupe.rows.length > 0) {
      const error = new Error('Bu telefon raqami bilan xodim allaqachon mavjud');
      error.statusCode = HTTP_STATUS.CONFLICT;
      throw error;
    }
  }

  // `deleted_at IS NULL` — arxivlangan xodimni (migratsiya 060)
  // tahrirlab bo'lmaydi; 0 qator qaytsa chaqiruvchi 404 beradi.
  const sql = `
    UPDATE employees
    SET ${setClauses.join(', ')}
    WHERE id = $${paramCount} AND deleted_at IS NULL
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
  // Arxivlangan xodimni (migratsiya 060) tahrirlab bo'lmaydi.
  const currentResult = await query('SELECT photo_url FROM employees WHERE id = $1 AND deleted_at IS NULL', [id]);

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
 * Generates a fresh, short-lived, one-time Telegram link code for an
 * employee (XAVFSIZLIK-AUDIT.md K-4 fix). HR relays this code to the
 * employee out-of-band (in person, phone, existing chat) — the employee
 * then sends it to the bot, which links their chat_id only if the code
 * matches AND hasn't expired. Generating a new code overwrites/invalidates
 * any earlier unused one for the same employee (unique index on the
 * column means a fresh collision would otherwise fail the UPDATE).
 */
export async function generateTelegramLinkCode(id) {
  // Arxivlangan xodim (migratsiya 060) uchun yangi Telegram bog'lash
  // kodi yaratib bo'lmaydi.
  const employeeResult = await query('SELECT id, telegram_chat_id FROM employees WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (employeeResult.rows.length === 0) {
    const error = new Error(MESSAGES.EMPLOYEE_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_CODE_TTL_MS);

  // A fresh code could theoretically collide with another employee's
  // still-valid one (6 chars from a 32-symbol alphabet — astronomically
  // unlikely, but the unique index would reject it outright rather than
  // silently overwrite). Retry a handful of times instead of surfacing a
  // confusing DB error to HR.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateLinkCode(6);
    try {
      const result = await query(
        `UPDATE employees
         SET telegram_link_code = $1, telegram_link_code_expires_at = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, telegram_link_code, telegram_link_code_expires_at`,
        [code, expiresAt, id]
      );
      return {
        code: result.rows[0].telegram_link_code,
        expiresAt: result.rows[0].telegram_link_code_expires_at,
      };
    } catch (err) {
      if (err.code === '23505') continue; // unique_violation — try another code
      throw err;
    }
  }

  const error = new Error("Bog'lash kodi yaratib bo'lmadi, qayta urinib ko'ring");
  error.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  throw error;
}

/**
 * Update employee resume
 * Returns the updated employee row and the previous resume URL (for cleanup)
 */
export async function updateEmployeeResume(id, resumeUrl, resumeOriginalName) {
  // Arxivlangan xodimni (migratsiya 060) tahrirlab bo'lmaydi.
  const currentResult = await query('SELECT resume_url FROM employees WHERE id = $1 AND deleted_at IS NULL', [id]);

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
 * Remove an employee — archives rather than destroys whenever there is
 * anything worth keeping.
 *
 * XAVFSIZLIK-AUDIT.md (2-pass, data integrity #4). This used to be a bare
 * `DELETE FROM employees`, and every dependent table (employee_fines,
 * salary_payments, attendance_records, applications, ...) hangs off it
 * with `ON DELETE CASCADE` — so one click irreversibly destroyed an
 * employee's whole financial and legal history. The 2-pass change only
 * *recorded* what was destroyed; migration 060 + this function stop the
 * destruction itself:
 *
 *  - has any history (fine / payment / attendance / application)
 *      -> ARCHIVE: set `deleted_at`. The row and all its history stay in
 *         the database; the employee disappears from the active roster and
 *         from every "new action" path (see the `deleted_at IS NULL`
 *         filters added alongside this), while past reports still resolve
 *         their name correctly.
 *  - has no history at all (a mis-typed candidate, a duplicate row)
 *      -> HARD DELETE: nothing of value exists to preserve, and leaving
 *         the row would only clutter the roster and hold its
 *         employee_number / person_id unique index entries hostage.
 *
 * Which branch ran is returned to the caller so it can be written to
 * audit_logs (see employees.controller.js#deleteEmployee).
 */
export async function deleteEmployee(id) {
  const existing = await query(
    `SELECT
       e.first_name, e.last_name, e.employee_number, e.deleted_at,
       (SELECT COUNT(*) FROM employee_fines ef WHERE ef.employee_id = e.id) AS fines_count,
       (SELECT COUNT(*) FROM salary_payments sp WHERE sp.employee_id = e.id) AS payments_count,
       (SELECT COUNT(*) FROM attendance_records ar WHERE ar.employee_id = e.id) AS attendance_count,
       (SELECT COUNT(*) FROM applications ap WHERE ap.employee_id = e.id) AS applications_count
     FROM employees e
     WHERE e.id = $1`,
    [id]
  );

  if (existing.rows.length === 0 || existing.rows[0].deleted_at) {
    // An already-archived employee is treated as gone — repeating the
    // request must not look like it destroyed something a second time.
    const error = new Error(MESSAGES.EMPLOYEE_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const snapshot = existing.rows[0];
  const preservedCounts = {
    fines: Number(snapshot.fines_count),
    salaryPayments: Number(snapshot.payments_count),
    attendanceRecords: Number(snapshot.attendance_count),
    applications: Number(snapshot.applications_count),
  };
  const hasHistory = Object.values(preservedCounts).some((n) => n > 0);

  if (hasHistory) {
    await query('UPDATE employees SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);
  } else {
    await query('DELETE FROM employees WHERE id = $1', [id]);
  }

  return {
    id,
    mode: hasHistory ? 'archived' : 'deleted',
    employeeName: `${snapshot.first_name} ${snapshot.last_name}`,
    employeeNumber: snapshot.employee_number,
    preservedCounts,
  };
}

