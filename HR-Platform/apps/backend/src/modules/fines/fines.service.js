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
