import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';

/**
 * Fines Service
 * Two related catalogs, both configured from Moliya > Jarimalar:
 *  - fine_types ("Jazo turi") — punishments like "Ogohlantirish", created
 *    ad-hoc via "Jazo yaratish".
 *  - fine_policies + fine_policy_templates ("Jarima yaratish") — named
 *    policies (e.g. "Sotuvchilar, ofitsiantlar") made of violation -> time
 *    limit -> amount -> punishment templates.
 */

function mapFineType(row) {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function listFineTypes() {
  const result = await query('SELECT * FROM fine_types ORDER BY name');
  return result.rows.map(mapFineType);
}

export async function createFineType(name, userId) {
  const trimmed = name.trim();
  if (!trimmed) {
    const error = new Error('Jazo turi nomini kiriting');
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  const existing = await query('SELECT * FROM fine_types WHERE LOWER(name) = LOWER($1)', [trimmed]);
  if (existing.rows.length > 0) {
    return mapFineType(existing.rows[0]);
  }

  const result = await query(
    'INSERT INTO fine_types (name, created_by) VALUES ($1, $2) RETURNING *',
    [trimmed, userId]
  );
  return mapFineType(result.rows[0]);
}

export async function deleteFineType(id) {
  const result = await query('DELETE FROM fine_types WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    const error = new Error('Jazo turi topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return { success: true, id };
}

function mapPolicy(row) {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    templates: row.templates || [],
    employeeIds: row.employee_ids || [],
    employees: row.employees || [],
  };
}

const SELECT_POLICY_WITH_TEMPLATES = `
  SELECT
    fp.*,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', fpt.id,
          'violationType', fpt.violation_type,
          'timeLimit', fpt.time_limit,
          'amount', fpt.amount,
          'fineTypeId', fpt.fine_type_id
        )
        ORDER BY fpt.created_at
      ) FROM fine_policy_templates fpt WHERE fpt.policy_id = fp.id),
      '[]'
    ) AS templates,
    COALESCE(
      (SELECT json_agg(
        json_build_object('id', e.id, 'firstName', e.first_name, 'lastName', e.last_name, 'position', e.position, 'phone', e.phone)
        ORDER BY e.first_name
      ) FROM fine_policy_employees fpe JOIN employees e ON e.id = fpe.employee_id WHERE fpe.policy_id = fp.id),
      '[]'
    ) AS employees,
    COALESCE(
      (SELECT array_agg(fpe.employee_id) FROM fine_policy_employees fpe WHERE fpe.policy_id = fp.id),
      '{}'
    ) AS employee_ids
  FROM fine_policies fp
`;

export async function listFinePolicies() {
  const result = await query(`${SELECT_POLICY_WITH_TEMPLATES} ORDER BY fp.created_at DESC`);
  return result.rows.map(mapPolicy);
}

export async function getFinePolicyById(id) {
  const result = await query(`${SELECT_POLICY_WITH_TEMPLATES} WHERE fp.id = $1`, [id]);
  if (result.rows.length === 0) {
    const error = new Error('Jarima siyosati topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return mapPolicy(result.rows[0]);
}

async function replaceTemplates(client, policyId, templates) {
  await client.query('DELETE FROM fine_policy_templates WHERE policy_id = $1', [policyId]);

  if (!templates || templates.length === 0) return;

  const params = [policyId];
  const valueRows = templates.map((t) => {
    const start = params.length + 1;
    params.push(t.violationType, t.timeLimit || null, t.amount ?? 0, t.fineTypeId || null);
    return `($1, $${start}, $${start + 1}, $${start + 2}, $${start + 3})`;
  });

  await client.query(
    `INSERT INTO fine_policy_templates (policy_id, violation_type, time_limit, amount, fine_type_id)
     VALUES ${valueRows.join(', ')}`,
    params
  );
}

async function assignPolicyEmployees(client, policyId, employeeIds) {
  await client.query('DELETE FROM fine_policy_employees WHERE policy_id = $1', [policyId]);

  if (!employeeIds || employeeIds.length === 0) return;

  const params = [policyId];
  const valueRows = employeeIds.map((employeeId) => {
    params.push(employeeId);
    return `($1, $${params.length})`;
  });

  await client.query(
    `INSERT INTO fine_policy_employees (policy_id, employee_id) VALUES ${valueRows.join(', ')}`,
    params
  );
}

export async function createFinePolicy(data, userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO fine_policies (name, enabled, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [data.name, data.enabled, userId]
    );

    const policyId = insertResult.rows[0].id;
    await replaceTemplates(client, policyId, data.templates);
    await assignPolicyEmployees(client, policyId, data.employeeIds);

    await client.query('COMMIT');
    return getFinePolicyById(policyId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateFinePolicy(id, data) {
  await getFinePolicyById(id); // 404 if missing

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE fine_policies SET name = $1, enabled = $2, updated_at = NOW() WHERE id = $3`,
      [data.name, data.enabled, id]
    );

    await replaceTemplates(client, id, data.templates);
    await assignPolicyEmployees(client, id, data.employeeIds);

    await client.query('COMMIT');
    return getFinePolicyById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteFinePolicy(id) {
  await getFinePolicyById(id); // 404 if missing
  await query('DELETE FROM fine_policies WHERE id = $1', [id]);
  return { success: true, id };
}

/**
 * Xodimga tayinlangan (haqiqatan tortilgan) jarimalar — "Tayinlangan
 * jarimalar ro'yxati". fine_types katalogiga va ixtiyoriy isbot fayliga
 * bog'lanadi; fine_policies (siyosat/shablon katalogi)dan farqli — bu
 * konkret bir xodimga qo'llangan haqiqiy voqea.
 */
function mapEmployeeFine(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    amount: Number(row.amount),
    fineTypeId: row.fine_type_id,
    fineTypeName: row.fine_type_name || null,
    note: row.note,
    fileUrl: row.file_url,
    fileName: row.file_name,
    source: row.source,
    policyTemplateId: row.policy_template_id,
    violationDate: row.violation_date,
    status: row.status,
    punishmentStatus: row.punishment_status,
    punishmentNote: row.punishment_note,
    punishmentRecordedAt: row.punishment_recorded_at,
    createdAt: row.created_at,
  };
}

async function getEmployeeFineById(id) {
  const [row] = await query(
    `SELECT ef.*, ft.name AS fine_type_name
     FROM employee_fines ef
     LEFT JOIN fine_types ft ON ft.id = ef.fine_type_id
     WHERE ef.id = $1`,
    [id]
  ).then((r) => r.rows);
  return row;
}

export async function listEmployeeFines({
  employeeId, branches, departments, positions, scheduleIds, startDate, endDate,
} = {}) {
  const conditions = [];
  const params = [];

  if (employeeId) {
    params.push(employeeId);
    conditions.push(`ef.employee_id = $${params.length}`);
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
      WHERE wse.employee_id = ef.employee_id AND wse.schedule_id = ANY($${params.length})
    )`);
  }
  if (startDate) {
    params.push(startDate);
    conditions.push(`ef.created_at::date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`ef.created_at::date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT ef.*, ft.name AS fine_type_name
     FROM employee_fines ef
     JOIN employees e ON e.id = ef.employee_id
     LEFT JOIN fine_types ft ON ft.id = ef.fine_type_id
     ${where}
     ORDER BY ef.created_at DESC`,
    params
  );

  return result.rows.map(mapEmployeeFine);
}

export async function createEmployeeFine({ employeeId, amount, fineTypeId, note, fileUrl, fileName, createdBy }) {
  const employeeCheck = await query('SELECT id FROM employees WHERE id = $1', [employeeId]);
  if (employeeCheck.rows.length === 0) {
    const error = new Error('Xodim topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const result = await query(
    `INSERT INTO employee_fines (employee_id, amount, fine_type_id, note, file_url, file_name, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [employeeId, amount, fineTypeId || null, note || null, fileUrl || null, fileName || null, createdBy]
  );

  const row = await getEmployeeFineById(result.rows[0].id);
  return mapEmployeeFine(row);
}

/**
 * HR "Bajardi"/"Bajarmadi" belgisini sababi bilan yozadi — jazo turi
 * (fine_type, masalan "30 daqiqalik qo'shimcha ish") xodim tomonidan
 * haqiqatan bajarilganmi-yo'qmi shuni kuzatadi.
 */
export async function updateFinePunishmentStatus(id, { status, note, recordedBy }) {
  const existing = await getEmployeeFineById(id);
  if (!existing) {
    const error = new Error('Jarima topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  await query(
    `UPDATE employee_fines
     SET punishment_status = $1, punishment_note = $2, punishment_recorded_by = $3, punishment_recorded_at = NOW()
     WHERE id = $4`,
    [status, note || null, recordedBy, id]
  );

  const row = await getEmployeeFineById(id);
  return mapEmployeeFine(row);
}

export async function deleteEmployeeFine(id) {
  const result = await query('DELETE FROM employee_fines WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    const error = new Error('Jarima topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return { success: true, id };
}

/**
 * Tushuntirish xati (apellatsiya) — Telegram bot orqali yuborilgan, HR
 * tasdiqlasa bog'liq jarima "bekor_qilindi" bo'ladi.
 */
function mapFineAppeal(row) {
  return {
    id: row.id,
    employeeFineId: row.employee_fine_id,
    employeeId: row.employee_id,
    employeeName: row.employee_first_name ? `${row.employee_first_name} ${row.employee_last_name}` : null,
    category: row.category,
    incidentDate: row.incident_date,
    handoverPerson: row.handover_person,
    returnAt: row.return_at,
    fineAmount: row.fine_amount != null ? Number(row.fine_amount) : null,
    fineTypeName: row.fine_type_name || null,
    fineViolationDate: row.fine_violation_date,
    reason: row.reason,
    fileUrl: row.file_url,
    fileName: row.file_name,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedByEmployeeId: row.reviewed_by_employee_id,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    forwardedToManagerAt: row.forwarded_to_manager_at,
    createdAt: row.created_at,
  };
}

const SELECT_FINE_APPEAL = `
  SELECT fa.*, e.first_name AS employee_first_name, e.last_name AS employee_last_name,
         ef.amount AS fine_amount, ef.violation_date AS fine_violation_date, ft.name AS fine_type_name
  FROM fine_appeals fa
  JOIN employees e ON e.id = fa.employee_id
  LEFT JOIN employee_fines ef ON ef.id = fa.employee_fine_id
  LEFT JOIN fine_types ft ON ft.id = ef.fine_type_id
`;

/**
 * Ariza berilganda, agar shu xodimning aynan shu tur+sana uchun faol
 * jarimasi allaqachon mavjud bo'lsa — arizani o'shanga avtomatik bog'laydi
 * (tasdiqlansa, o'sha jarima bekor bo'ladi). Aniq bitta moslik topilmasa
 * (yo'q yoki bir nechta) — bog'lanmaydi, ariza "umumiy" tushuntirish
 * sifatida qoladi, HR o'zi qaror qiladi.
 */
async function findMatchingFineId(employeeId, category, incidentDate) {
  if (category === 'umumiy' || !incidentDate) return null;

  const { rows } = await query(
    `SELECT ef.id
     FROM employee_fines ef
     LEFT JOIN fine_policy_templates fpt ON fpt.id = ef.policy_template_id
     WHERE ef.employee_id = $1
       AND ef.status = 'faol'
       AND (ef.violation_date = $2 OR ef.created_at::date = $2)
       AND (fpt.violation_type = $3 OR ef.policy_template_id IS NULL)
       AND NOT EXISTS (SELECT 1 FROM fine_appeals fa WHERE fa.employee_fine_id = ef.id AND fa.status = 'kutilmoqda')
     LIMIT 2`,
    [employeeId, incidentDate, category]
  );
  return rows.length === 1 ? rows[0].id : null;
}

export async function createFineAppeal({
  employeeId, category, incidentDate, reason, fileUrl, fileName, handoverPerson, returnAt,
}) {
  const employeeFineId = await findMatchingFineId(employeeId, category, incidentDate);

  const conflictClause = employeeFineId
    ? "ON CONFLICT (employee_fine_id) WHERE status = 'kutilmoqda' DO NOTHING"
    : "ON CONFLICT (employee_id, category, incident_date) WHERE status = 'kutilmoqda' AND employee_fine_id IS NULL DO NOTHING";

  const result = await query(
    `INSERT INTO fine_appeals (employee_fine_id, employee_id, category, incident_date, reason, file_url, file_name, handover_person, return_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ${conflictClause}
     RETURNING id`,
    [employeeFineId, employeeId, category, incidentDate || null, reason, fileUrl || null, fileName || null, handoverPerson || null, returnAt || null]
  );

  if (result.rows.length === 0) {
    const error = new Error('Shu tur va sana uchun allaqachon kutilayotgan ariza mavjud');
    error.statusCode = HTTP_STATUS.CONFLICT;
    throw error;
  }

  const [row] = await query(`${SELECT_FINE_APPEAL} WHERE fa.id = $1`, [result.rows[0].id]).then((r) => r.rows);
  return mapFineAppeal(row);
}

export async function listFineAppeals({ status } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`fa.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`${SELECT_FINE_APPEAL} ${where} ORDER BY fa.created_at DESC`, params);
  return result.rows.map(mapFineAppeal);
}

export async function getFineAppealById(id) {
  const [row] = await query(`${SELECT_FINE_APPEAL} WHERE fa.id = $1`, [id]).then((r) => r.rows);
  return row ? mapFineAppeal(row) : null;
}

/**
 * `reviewedBy` (users.id) is set when HR reviews via the web panel;
 * `reviewedByEmployeeId` (employees.id) is set when the Rahbar reviews via
 * their own Telegram bot chat instead — exactly one of the two is passed,
 * never both.
 */
export async function reviewFineAppeal(id, { status, note, reviewedBy, reviewedByEmployeeId }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE fine_appeals
       SET status = $1, review_note = $2, reviewed_by = $3, reviewed_by_employee_id = $4, reviewed_at = NOW()
       WHERE id = $5 AND status = 'kutilmoqda'
       RETURNING employee_fine_id`,
      [status, note || null, reviewedBy || null, reviewedByEmployeeId || null, id]
    );

    if (rows.length === 0) {
      const error = new Error('Ariza topilmadi yoki allaqachon ko\'rib chiqilgan');
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    // Proaktiv arizalarda (hali jarima yozilmagan) employee_fine_id bo'sh
    // bo'lishi mumkin — bekor qiladigan aniq jarima yo'q, faqat tasdiqlanadi.
    if (status === 'tasdiqlandi' && rows[0].employee_fine_id) {
      await client.query(`UPDATE employee_fines SET status = 'bekor_qilindi' WHERE id = $1`, [rows[0].employee_fine_id]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getFineAppealById(id);
}

/** Marks an appeal as escalated to the Rahbar — only while still pending, mirroring reviewFineAppeal's guard. */
export async function markAppealForwardedToManager(id) {
  const result = await query(
    `UPDATE fine_appeals SET forwarded_to_manager_at = NOW()
     WHERE id = $1 AND status = 'kutilmoqda'
     RETURNING id`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return getFineAppealById(id);
}

/** The single employee flagged as the bot-approval Rahbar (see migration 051), or null if none is assigned yet. */
export async function getBotManagerEmployee() {
  const { rows } = await query(
    `SELECT id, first_name, last_name, telegram_chat_id FROM employees WHERE is_bot_manager = true LIMIT 1`
  );
  return rows[0] || null;
}
