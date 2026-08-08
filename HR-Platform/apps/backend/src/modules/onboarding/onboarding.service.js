import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';
import { generateInviteToken } from '../../shared/utils/crypto.js';

/**
 * Onboarding Service
 * A plan (onboarding_plans) is a named, ordered checklist (onboarding_plan_steps).
 * Assigning a plan to an employee (onboarding_assignments) mints that employee
 * a unique, unauthenticated public link (public_token) — they tick off steps
 * (onboarding_step_completions) without ever logging in.
 */

function mapStep(row) {
  return { id: row.id, title: row.title, description: row.description, orderIndex: row.order_index };
}

function mapPlan(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stepCount: Number(row.step_count) || 0,
    assignmentCount: Number(row.assignment_count) || 0,
    steps: row.steps || [],
  };
}

const SELECT_PLANS = `
  SELECT
    p.*,
    COUNT(DISTINCT s.id) AS step_count,
    COUNT(DISTINCT a.id) AS assignment_count
  FROM onboarding_plans p
  LEFT JOIN onboarding_plan_steps s ON s.plan_id = p.id
  LEFT JOIN onboarding_assignments a ON a.plan_id = p.id
`;

export async function listPlans() {
  const result = await query(`${SELECT_PLANS} GROUP BY p.id ORDER BY p.created_at DESC`);
  return result.rows.map(mapPlan);
}

async function attachSteps(plan) {
  const result = await query(
    'SELECT * FROM onboarding_plan_steps WHERE plan_id = $1 ORDER BY order_index',
    [plan.id]
  );
  return { ...plan, steps: result.rows.map(mapStep) };
}

export async function getPlanById(id) {
  const result = await query(`${SELECT_PLANS} WHERE p.id = $1 GROUP BY p.id`, [id]);
  if (result.rows.length === 0) {
    const error = new Error('Reja topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return attachSteps(mapPlan(result.rows[0]));
}

async function replaceSteps(client, planId, steps) {
  await client.query('DELETE FROM onboarding_plan_steps WHERE plan_id = $1', [planId]);
  if (!steps || steps.length === 0) return;

  const params = [planId];
  const valueRows = steps.map((s, idx) => {
    const start = params.length + 1;
    params.push(s.title, s.description || null, idx);
    return `($1, $${start}, $${start + 1}, $${start + 2})`;
  });

  await client.query(
    `INSERT INTO onboarding_plan_steps (plan_id, title, description, order_index) VALUES ${valueRows.join(', ')}`,
    params
  );
}

export async function createPlan(data, userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const insertResult = await client.query(
      `INSERT INTO onboarding_plans (name, description, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [data.name, data.description || null, userId]
    );
    const planId = insertResult.rows[0].id;
    await replaceSteps(client, planId, data.steps);
    await client.query('COMMIT');
    return getPlanById(planId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePlan(id, data) {
  await getPlanById(id); // 404 if missing

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE onboarding_plans SET name = $1, description = $2, updated_at = NOW() WHERE id = $3`,
      [data.name, data.description || null, id]
    );
    await replaceSteps(client, id, data.steps);
    await client.query('COMMIT');
    return getPlanById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePlan(id) {
  await getPlanById(id); // 404 if missing
  await query('DELETE FROM onboarding_plans WHERE id = $1', [id]);
  return { success: true, id };
}

function mapAssignment(row) {
  const totalSteps = Number(row.total_steps) || 0;
  const completedSteps = Number(row.completed_steps) || 0;
  return {
    id: row.id,
    planId: row.plan_id,
    planName: row.plan_name,
    employeeId: row.employee_id,
    employeeName: `${row.first_name} ${row.last_name}`,
    employeePhotoUrl: row.photo_url || null,
    publicToken: row.public_token,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    totalSteps,
    completedSteps,
    progress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    currentStepTitle: row.current_step_title || null,
    status: row.completed_at ? 'completed' : 'in_progress',
  };
}

const SELECT_ASSIGNMENTS = `
  SELECT
    a.*,
    p.name AS plan_name,
    e.first_name, e.last_name, e.photo_url,
    (SELECT COUNT(*) FROM onboarding_plan_steps WHERE plan_id = a.plan_id) AS total_steps,
    (SELECT COUNT(*) FROM onboarding_step_completions WHERE assignment_id = a.id) AS completed_steps,
    (
      SELECT s.title FROM onboarding_plan_steps s
      WHERE s.plan_id = a.plan_id
        AND s.id NOT IN (
          SELECT step_id FROM onboarding_step_completions WHERE assignment_id = a.id
        )
      ORDER BY s.order_index
      LIMIT 1
    ) AS current_step_title
  FROM onboarding_assignments a
  JOIN onboarding_plans p ON p.id = a.plan_id
  JOIN employees e ON e.id = a.employee_id
`;

export async function listAssignments() {
  const result = await query(`${SELECT_ASSIGNMENTS} ORDER BY a.created_at DESC`);
  return result.rows.map(mapAssignment);
}

export async function createAssignment(planId, employeeId, userId) {
  await getPlanById(planId); // 404 if plan missing

  const employeeCheck = await query('SELECT id FROM employees WHERE id = $1', [employeeId]);
  if (employeeCheck.rows.length === 0) {
    const error = new Error('Xodim topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const token = generateInviteToken();
  const result = await query(
    `INSERT INTO onboarding_assignments (plan_id, employee_id, public_token, created_by)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [planId, employeeId, token, userId]
  );

  const [assignment] = (await query(`${SELECT_ASSIGNMENTS} WHERE a.id = $1`, [result.rows[0].id])).rows;
  return mapAssignment(assignment);
}

export async function deleteAssignment(id) {
  const result = await query('DELETE FROM onboarding_assignments WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    const error = new Error('Biriktirilgan reja topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return { success: true, id };
}

/**
 * Public (unauthenticated, token-gated) reads/writes — the employee-facing side.
 */
export async function getAssignmentByToken(token) {
  const [assignment] = (await query(`${SELECT_ASSIGNMENTS} WHERE a.public_token = $1`, [token])).rows;
  if (!assignment) {
    const error = new Error('Havola topilmadi yoki eskirgan');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const steps = (await query(
    'SELECT * FROM onboarding_plan_steps WHERE plan_id = $1 ORDER BY order_index',
    [assignment.plan_id]
  )).rows.map(mapStep);

  const completedStepIds = (await query(
    'SELECT step_id FROM onboarding_step_completions WHERE assignment_id = $1',
    [assignment.id]
  )).rows.map((r) => r.step_id);

  return {
    ...mapAssignment(assignment),
    steps,
    completedStepIds,
  };
}

async function recomputeAssignmentCompletion(assignmentId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM onboarding_plan_steps s
          JOIN onboarding_assignments a ON a.plan_id = s.plan_id WHERE a.id = $1) AS total,
       (SELECT COUNT(*) FROM onboarding_step_completions WHERE assignment_id = $1) AS done`,
    [assignmentId]
  );
  const { total, done } = result.rows[0];
  const isComplete = Number(total) > 0 && Number(total) === Number(done);
  await query(
    'UPDATE onboarding_assignments SET completed_at = CASE WHEN $2 THEN COALESCE(completed_at, NOW()) ELSE NULL END WHERE id = $1',
    [assignmentId, isComplete]
  );
}

export async function toggleStepCompletion(token, stepId, completed) {
  const assignmentResult = await query(
    'SELECT id, plan_id FROM onboarding_assignments WHERE public_token = $1',
    [token]
  );
  if (assignmentResult.rows.length === 0) {
    const error = new Error('Havola topilmadi yoki eskirgan');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  const assignment = assignmentResult.rows[0];

  const stepCheck = await query(
    'SELECT id FROM onboarding_plan_steps WHERE id = $1 AND plan_id = $2',
    [stepId, assignment.plan_id]
  );
  if (stepCheck.rows.length === 0) {
    const error = new Error('Bosqich topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  if (completed) {
    await query(
      `INSERT INTO onboarding_step_completions (assignment_id, step_id) VALUES ($1, $2)
       ON CONFLICT (assignment_id, step_id) DO NOTHING`,
      [assignment.id, stepId]
    );
  } else {
    await query(
      'DELETE FROM onboarding_step_completions WHERE assignment_id = $1 AND step_id = $2',
      [assignment.id, stepId]
    );
  }

  await recomputeAssignmentCompletion(assignment.id);
  return getAssignmentByToken(token);
}
