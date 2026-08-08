import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';
import { generateInviteToken } from '../../shared/utils/crypto.js';

/**
 * Onboarding Service
 * A plan (onboarding_plans) is an ordered list of "bosqich" (onboarding_plan_steps),
 * each of which is a container for one or more "vazifa" (onboarding_step_tasks) —
 * a video or text task the employee actually checks off. Assigning a plan to an
 * employee (onboarding_assignments) mints them a unique, unauthenticated public
 * link (public_token) — they tick off tasks (onboarding_step_completions) without
 * ever logging in.
 */

function mapTask(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    videoUrl: row.video_url,
    documentUrl: row.document_url,
    documentName: row.document_name,
    description: row.description,
    orderIndex: row.order_index,
  };
}

function mapStep(row) {
  return { id: row.id, orderIndex: row.order_index, tasks: row.tasks || [] };
}

function mapPlan(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stepCount: Number(row.step_count) || 0,
    taskCount: Number(row.task_count) || 0,
    assignmentCount: Number(row.assignment_count) || 0,
    steps: row.steps || [],
  };
}

const SELECT_PLANS = `
  SELECT
    p.*,
    COUNT(DISTINCT s.id) AS step_count,
    COUNT(DISTINCT t.id) AS task_count,
    COUNT(DISTINCT a.id) AS assignment_count
  FROM onboarding_plans p
  LEFT JOIN onboarding_plan_steps s ON s.plan_id = p.id
  LEFT JOIN onboarding_step_tasks t ON t.step_id = s.id
  LEFT JOIN onboarding_assignments a ON a.plan_id = p.id
`;

/**
 * Batches steps+tasks for any number of plans in two queries total (not
 * N+1) — used by both listPlans() and getPlanById() so the "Rejalar" grid
 * always carries full nested data, not just the counts. Without this,
 * editing a plan straight from the list (as the frontend does, reusing
 * already-loaded data instead of a fresh per-plan fetch) would silently
 * see zero steps and overwrite the real ones on save.
 */
async function attachStepsToPlans(plans) {
  if (plans.length === 0) return plans;

  const stepsResult = await query(
    'SELECT * FROM onboarding_plan_steps WHERE plan_id = ANY($1) ORDER BY plan_id, order_index',
    [plans.map((p) => p.id)]
  );
  const steps = stepsResult.rows.map((row) => ({ ...mapStep(row), planId: row.plan_id }));

  if (steps.length > 0) {
    const tasksResult = await query(
      'SELECT * FROM onboarding_step_tasks WHERE step_id = ANY($1) ORDER BY step_id, order_index',
      [steps.map((s) => s.id)]
    );
    const tasksByStep = {};
    for (const row of tasksResult.rows) {
      (tasksByStep[row.step_id] ||= []).push(mapTask(row));
    }
    steps.forEach((s) => { s.tasks = tasksByStep[s.id] || []; });
  }

  const stepsByPlan = {};
  for (const { planId, ...step } of steps) {
    (stepsByPlan[planId] ||= []).push(step);
  }

  return plans.map((p) => ({ ...p, steps: stepsByPlan[p.id] || [] }));
}

export async function listPlans() {
  const result = await query(`${SELECT_PLANS} GROUP BY p.id ORDER BY p.created_at DESC`);
  return attachStepsToPlans(result.rows.map(mapPlan));
}

export async function getPlanById(id) {
  const result = await query(`${SELECT_PLANS} WHERE p.id = $1 GROUP BY p.id`, [id]);
  if (result.rows.length === 0) {
    const error = new Error('Reja topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  const [plan] = await attachStepsToPlans([mapPlan(result.rows[0])]);
  return plan;
}

async function replaceSteps(client, planId, steps) {
  await client.query('DELETE FROM onboarding_plan_steps WHERE plan_id = $1', [planId]);
  if (!steps || steps.length === 0) return;

  for (let stepIdx = 0; stepIdx < steps.length; stepIdx += 1) {
    const step = steps[stepIdx];
    const stepResult = await client.query(
      'INSERT INTO onboarding_plan_steps (plan_id, order_index) VALUES ($1, $2) RETURNING id',
      [planId, stepIdx]
    );
    const stepId = stepResult.rows[0].id;

    const tasks = step.tasks || [];
    if (tasks.length === 0) continue;

    const params = [stepId];
    const valueRows = tasks.map((t, taskIdx) => {
      const start = params.length + 1;
      params.push(t.type, t.title, t.videoUrl || null, t.documentUrl || null, t.documentName || null, t.description || null, taskIdx);
      return `($1, $${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5}, $${start + 6})`;
    });

    await client.query(
      `INSERT INTO onboarding_step_tasks (step_id, type, title, video_url, document_url, document_name, description, order_index) VALUES ${valueRows.join(', ')}`,
      params
    );
  }
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
  const totalTasks = Number(row.total_tasks) || 0;
  const completedTasks = Number(row.completed_tasks) || 0;
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
    totalSteps: totalTasks,
    completedSteps: completedTasks,
    progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    currentStepTitle: row.current_task_title || null,
    status: row.completed_at ? 'completed' : 'in_progress',
  };
}

const SELECT_ASSIGNMENTS = `
  SELECT
    a.*,
    p.name AS plan_name,
    e.first_name, e.last_name, e.photo_url,
    (
      SELECT COUNT(*) FROM onboarding_step_tasks t
      JOIN onboarding_plan_steps s ON s.id = t.step_id
      WHERE s.plan_id = a.plan_id
    ) AS total_tasks,
    (SELECT COUNT(*) FROM onboarding_step_completions WHERE assignment_id = a.id) AS completed_tasks,
    (
      SELECT t.title FROM onboarding_step_tasks t
      JOIN onboarding_plan_steps s ON s.id = t.step_id
      WHERE s.plan_id = a.plan_id
        AND t.id NOT IN (
          SELECT task_id FROM onboarding_step_completions WHERE assignment_id = a.id
        )
      ORDER BY s.order_index, t.order_index
      LIMIT 1
    ) AS current_task_title
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

export async function getStats() {
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM onboarding_plans) AS total_plans,
      COUNT(*) AS total_assignments,
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed_count,
      COUNT(*) FILTER (WHERE completed_at IS NULL) AS in_progress_count,
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND completed_at - created_at <= INTERVAL '7 days') AS within_7_days_count
    FROM onboarding_assignments
  `);

  const row = result.rows[0];
  const totalAssignments = Number(row.total_assignments) || 0;
  const completedCount = Number(row.completed_count) || 0;
  const within7DaysCount = Number(row.within_7_days_count) || 0;

  return {
    totalPlans: Number(row.total_plans) || 0,
    totalAssignments,
    completedCount,
    inProgressCount: Number(row.in_progress_count) || 0,
    completionRate: totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0,
    within7DaysCount,
    within7DaysRate: totalAssignments > 0 ? Math.round((within7DaysCount / totalAssignments) * 100) : 0,
  };
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

  const stepsResult = await query(
    'SELECT * FROM onboarding_plan_steps WHERE plan_id = $1 ORDER BY order_index',
    [assignment.plan_id]
  );
  const steps = stepsResult.rows.map(mapStep);

  if (steps.length > 0) {
    const tasksResult = await query(
      'SELECT * FROM onboarding_step_tasks WHERE step_id = ANY($1) ORDER BY step_id, order_index',
      [steps.map((s) => s.id)]
    );
    const tasksByStep = {};
    for (const row of tasksResult.rows) {
      (tasksByStep[row.step_id] ||= []).push(mapTask(row));
    }
    steps.forEach((s) => { s.tasks = tasksByStep[s.id] || []; });
  }

  const completedTaskIds = (await query(
    'SELECT task_id FROM onboarding_step_completions WHERE assignment_id = $1',
    [assignment.id]
  )).rows.map((r) => r.task_id);

  return {
    ...mapAssignment(assignment),
    steps,
    completedStepIds: completedTaskIds,
  };
}

async function recomputeAssignmentCompletion(assignmentId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM onboarding_step_tasks t
          JOIN onboarding_plan_steps s ON s.id = t.step_id
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

export async function toggleStepCompletion(token, taskId, completed) {
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

  const taskCheck = await query(
    `SELECT t.id FROM onboarding_step_tasks t
     JOIN onboarding_plan_steps s ON s.id = t.step_id
     WHERE t.id = $1 AND s.plan_id = $2`,
    [taskId, assignment.plan_id]
  );
  if (taskCheck.rows.length === 0) {
    const error = new Error('Vazifa topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  if (completed) {
    await query(
      `INSERT INTO onboarding_step_completions (assignment_id, task_id) VALUES ($1, $2)
       ON CONFLICT (assignment_id, task_id) DO NOTHING`,
      [assignment.id, taskId]
    );
  } else {
    await query(
      'DELETE FROM onboarding_step_completions WHERE assignment_id = $1 AND task_id = $2',
      [assignment.id, taskId]
    );
  }

  await recomputeAssignmentCompletion(assignment.id);
  return getAssignmentByToken(token);
}
