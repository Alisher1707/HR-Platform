import { query, getClient } from '../../config/database.js';
import { HTTP_STATUS } from '../../config/constants.js';
import { generateInviteToken } from '../../shared/utils/crypto.js';

/**
 * Onboarding Service
 * A plan (onboarding_plans) is an ordered list of "bosqich" (onboarding_plan_steps),
 * each of which is a container for one or more "vazifa" (onboarding_step_tasks) —
 * a video, document or action task the employee actually completes. Assigning a
 * plan to an employee (onboarding_assignments) mints them a unique,
 * unauthenticated public link (public_token) — they submit each task (text,
 * file, or link — onboarding_step_completions) without ever logging in.
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

function mapCompletion(row) {
  return {
    taskId: row.task_id,
    completedAt: row.completed_at,
    submissionType: row.submission_type,
    submissionText: row.submission_text,
    submissionFileUrl: row.submission_file_url,
    submissionFileName: row.submission_file_name,
    submissionLink: row.submission_link,
    reviewStatus: row.review_status,
    reviewedAt: row.reviewed_at,
    reviewComment: row.review_comment,
  };
}

function mapPlan(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    department: row.department,
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
  LEFT JOIN onboarding_plan_steps s ON s.plan_id = p.id AND s.archived_at IS NULL
  LEFT JOIN onboarding_step_tasks t ON t.step_id = s.id AND t.archived_at IS NULL
  LEFT JOIN onboarding_assignments a ON a.plan_id = p.id
`;

/**
 * Batches steps+tasks for any number of plans in two queries total (not
 * N+1) — used by both listPlans() and getPlanById() so the "Rejalar" grid
 * always carries full nested data, not just the counts. Without this,
 * editing a plan straight from the list (as the frontend does, reusing
 * already-loaded data instead of a fresh per-plan fetch) would silently
 * see zero steps and overwrite the real ones on save.
 *
 * Only ACTIVE (non-archived) steps/tasks are shown here — this is the
 * admin-facing "current shape of the plan" view. A step/task that was
 * removed by an HR edit but still has employee submissions tied to it is
 * archived, not deleted (see syncSteps below), and intentionally does not
 * reappear in this editor view; it stays visible only in the specific
 * assignment(s) that already completed it (attachStepsAndCompletions).
 */
async function attachStepsToPlans(plans) {
  if (plans.length === 0) return plans;

  const stepsResult = await query(
    'SELECT * FROM onboarding_plan_steps WHERE plan_id = ANY($1) AND archived_at IS NULL ORDER BY plan_id, order_index',
    [plans.map((p) => p.id)]
  );
  const steps = stepsResult.rows.map((row) => ({ ...mapStep(row), planId: row.plan_id }));

  if (steps.length > 0) {
    const tasksResult = await query(
      'SELECT * FROM onboarding_step_tasks WHERE step_id = ANY($1) AND archived_at IS NULL ORDER BY step_id, order_index',
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
      `INSERT INTO onboarding_plans (name, description, department, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [data.name, data.description || null, data.department || null, userId]
    );
    const planId = insertResult.rows[0].id;
    // A brand-new plan has no existing steps to preserve — a plain insert
    // (replaceSteps) is correct and simpler than the diffing syncSteps does.
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

/**
 * Reconciles a plan's steps/tasks with the edited form, in place —
 * matching by id instead of the old delete-everything-and-reinsert
 * approach. That approach was a real production bug: onboarding_step_
 * completions references onboarding_step_tasks(id) ON DELETE CASCADE, so
 * recreating every row on every save silently deleted every employee's
 * submitted work (text, files, HR review decisions) each time a plan was
 * edited — even for a one-word title fix untouched by the actual change.
 *
 * Rules:
 *  - An incoming step/task with an `id` matching an existing active row is
 *    UPDATEd in place (order preserved via its position in the array).
 *  - An incoming step/task without an id (or whose id doesn't match an
 *    existing active row) is a genuinely new one — INSERTed.
 *  - An existing active step/task that the incoming payload no longer
 *    contains was removed by the HR user in the editor. If nothing has
 *    ever been submitted against it, it's safe to DELETE outright. If it
 *    already has employee completions, deleting it would cascade-delete
 *    that history — so instead it's ARCHIVED (archived_at set), which
 *    hides it from the plan editor and from future assignments while
 *    keeping it visible in the specific assignment(s) that already
 *    completed it (see attachStepsAndCompletions).
 */
async function syncSteps(client, planId, incomingSteps) {
  const existingStepsResult = await client.query(
    'SELECT id FROM onboarding_plan_steps WHERE plan_id = $1 AND archived_at IS NULL',
    [planId]
  );
  const existingStepIds = new Set(existingStepsResult.rows.map((r) => r.id));
  const keptStepIds = new Set();

  const steps = incomingSteps || [];
  for (let stepIdx = 0; stepIdx < steps.length; stepIdx += 1) {
    const step = steps[stepIdx];
    const matchesExisting = step.id && existingStepIds.has(step.id);

    let stepId;
    if (matchesExisting) {
      stepId = step.id;
      keptStepIds.add(stepId);
      await client.query(
        'UPDATE onboarding_plan_steps SET order_index = $1 WHERE id = $2',
        [stepIdx, stepId]
      );
    } else {
      const inserted = await client.query(
        'INSERT INTO onboarding_plan_steps (plan_id, order_index) VALUES ($1, $2) RETURNING id',
        [planId, stepIdx]
      );
      stepId = inserted.rows[0].id;
    }

    await syncTasks(client, stepId, step.tasks || [], matchesExisting);
  }

  // Steps that existed before but are no longer in the incoming list —
  // the HR user removed them in the editor.
  const removedStepIds = [...existingStepIds].filter((id) => !keptStepIds.has(id));
  if (removedStepIds.length > 0) {
    const referencedResult = await client.query(
      `SELECT DISTINCT s.id FROM onboarding_plan_steps s
       JOIN onboarding_step_tasks t ON t.step_id = s.id
       JOIN onboarding_step_completions c ON c.task_id = t.id
       WHERE s.id = ANY($1)`,
      [removedStepIds]
    );
    const referencedStepIds = new Set(referencedResult.rows.map((r) => r.id));

    const toArchive = removedStepIds.filter((id) => referencedStepIds.has(id));
    const toDelete = removedStepIds.filter((id) => !referencedStepIds.has(id));

    if (toArchive.length > 0) {
      await client.query(
        'UPDATE onboarding_plan_steps SET archived_at = NOW() WHERE id = ANY($1)',
        [toArchive]
      );
      await client.query(
        'UPDATE onboarding_step_tasks SET archived_at = NOW() WHERE step_id = ANY($1) AND archived_at IS NULL',
        [toArchive]
      );
    }
    if (toDelete.length > 0) {
      // No completions anywhere under these steps — safe to hard-delete
      // (cascades to their tasks, which are equally unreferenced).
      await client.query('DELETE FROM onboarding_plan_steps WHERE id = ANY($1)', [toDelete]);
    }
  }
}

/**
 * Same reconciliation as syncSteps, one level down. `stepIsExisting` is
 * false for a brand-new step — in that case every task is necessarily new
 * too (an id on it, if present, cannot refer to a task under this step).
 */
async function syncTasks(client, stepId, incomingTasks, stepIsExisting) {
  let existingTaskIds = new Set();
  if (stepIsExisting) {
    const existingResult = await client.query(
      'SELECT id FROM onboarding_step_tasks WHERE step_id = $1 AND archived_at IS NULL',
      [stepId]
    );
    existingTaskIds = new Set(existingResult.rows.map((r) => r.id));
  }
  const keptTaskIds = new Set();

  for (let taskIdx = 0; taskIdx < incomingTasks.length; taskIdx += 1) {
    const t = incomingTasks[taskIdx];
    const matchesExisting = stepIsExisting && t.id && existingTaskIds.has(t.id);

    if (matchesExisting) {
      keptTaskIds.add(t.id);
      await client.query(
        `UPDATE onboarding_step_tasks
         SET type = $1, title = $2, video_url = $3, document_url = $4, document_name = $5, description = $6, order_index = $7
         WHERE id = $8`,
        [t.type, t.title, t.videoUrl || null, t.documentUrl || null, t.documentName || null, t.description || null, taskIdx, t.id]
      );
    } else {
      await client.query(
        `INSERT INTO onboarding_step_tasks (step_id, type, title, video_url, document_url, document_name, description, order_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [stepId, t.type, t.title, t.videoUrl || null, t.documentUrl || null, t.documentName || null, t.description || null, taskIdx]
      );
    }
  }

  const removedTaskIds = [...existingTaskIds].filter((id) => !keptTaskIds.has(id));
  if (removedTaskIds.length > 0) {
    const referencedResult = await client.query(
      'SELECT DISTINCT task_id FROM onboarding_step_completions WHERE task_id = ANY($1)',
      [removedTaskIds]
    );
    const referencedTaskIds = new Set(referencedResult.rows.map((r) => r.task_id));

    const toArchive = removedTaskIds.filter((id) => referencedTaskIds.has(id));
    const toDelete = removedTaskIds.filter((id) => !referencedTaskIds.has(id));

    if (toArchive.length > 0) {
      await client.query(
        'UPDATE onboarding_step_tasks SET archived_at = NOW() WHERE id = ANY($1)',
        [toArchive]
      );
    }
    if (toDelete.length > 0) {
      await client.query('DELETE FROM onboarding_step_tasks WHERE id = ANY($1)', [toDelete]);
    }
  }
}

export async function updatePlan(id, data) {
  await getPlanById(id); // 404 if missing

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE onboarding_plans SET name = $1, description = $2, department = $3, updated_at = NOW() WHERE id = $4`,
      [data.name, data.description || null, data.department || null, id]
    );
    await syncSteps(client, id, data.steps);
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
    pendingReviewSteps: Number(row.pending_review_tasks) || 0,
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
    -- "Visible to this assignment" = still active in the plan, OR archived
    -- but this specific assignment already has a completion against it
    -- (an edit that removed a task must not retroactively shrink an
    -- employee's already-earned progress denominator). A brand-new
    -- assignment never has completions yet, so it only ever sees active
    -- tasks — exactly the plan's current shape.
    (
      SELECT COUNT(*) FROM onboarding_step_tasks t
      JOIN onboarding_plan_steps s ON s.id = t.step_id
      WHERE s.plan_id = a.plan_id
        AND (t.archived_at IS NULL OR EXISTS (
          SELECT 1 FROM onboarding_step_completions c
          WHERE c.task_id = t.id AND c.assignment_id = a.id
        ))
    ) AS total_tasks,
    -- Faqat HR tomonidan qabul qilingan ("approved") vazifalar "bajarildi"
    -- hisoblanadi — shunchaki topshirilgani hali yetarli emas.
    (
      SELECT COUNT(*) FROM onboarding_step_completions
      WHERE assignment_id = a.id AND review_status = 'approved'
    ) AS completed_tasks,
    (
      SELECT COUNT(*) FROM onboarding_step_completions
      WHERE assignment_id = a.id AND review_status = 'pending'
    ) AS pending_review_tasks,
    (
      SELECT t.title FROM onboarding_step_tasks t
      JOIN onboarding_plan_steps s ON s.id = t.step_id
      WHERE s.plan_id = a.plan_id
        AND (t.archived_at IS NULL OR EXISTS (
          SELECT 1 FROM onboarding_step_completions c2
          WHERE c2.task_id = t.id AND c2.assignment_id = a.id
        ))
        AND t.id NOT IN (
          SELECT task_id FROM onboarding_step_completions
          WHERE assignment_id = a.id AND review_status = 'approved'
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
 * Bitta biriktirish uchun bosqich/vazifa daraxti va topshirilgan
 * vazifalarni birga yig'ib beradi — public token orqali (xodim) va admin
 * id orqali (Progress jadvalidagi "Ko'rish") ikkalasida ham ishlatiladi.
 *
 * Shows active steps/tasks, PLUS any archived one this specific assignment
 * already has a completion against — so editing a plan later never makes
 * an employee's already-submitted work vanish from their own history, while
 * a fresh assignment to the edited plan only ever sees its current shape.
 */
async function attachStepsAndCompletions(assignmentRow) {
  const stepsResult = await query(
    `SELECT s.* FROM onboarding_plan_steps s
     WHERE s.plan_id = $1
       AND (
         s.archived_at IS NULL
         OR EXISTS (
           SELECT 1 FROM onboarding_step_tasks t
           JOIN onboarding_step_completions c ON c.task_id = t.id
           WHERE t.step_id = s.id AND c.assignment_id = $2
         )
       )
     ORDER BY s.order_index`,
    [assignmentRow.plan_id, assignmentRow.id]
  );
  const steps = stepsResult.rows.map(mapStep);

  if (steps.length > 0) {
    const tasksResult = await query(
      `SELECT t.* FROM onboarding_step_tasks t
       WHERE t.step_id = ANY($1)
         AND (
           t.archived_at IS NULL
           OR EXISTS (
             SELECT 1 FROM onboarding_step_completions c
             WHERE c.task_id = t.id AND c.assignment_id = $2
           )
         )
       ORDER BY t.step_id, t.order_index`,
      [steps.map((s) => s.id), assignmentRow.id]
    );
    const tasksByStep = {};
    for (const row of tasksResult.rows) {
      (tasksByStep[row.step_id] ||= []).push(mapTask(row));
    }
    steps.forEach((s) => { s.tasks = tasksByStep[s.id] || []; });
  }

  const completions = (await query(
    'SELECT * FROM onboarding_step_completions WHERE assignment_id = $1',
    [assignmentRow.id]
  )).rows.map(mapCompletion);

  return { steps, completions };
}

/**
 * Public (unauthenticated, token-gated) reads/writes — the employee-facing side.
 */
export async function getAssignmentByToken(token) {
  const [assignment] = (await query(`${SELECT_ASSIGNMENTS} WHERE a.public_token = $1`, [token])).rows;
  if (!assignment || (assignment.expires_at && new Date(assignment.expires_at) <= new Date())) {
    const error = new Error('Havola topilmadi yoki eskirgan');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const { steps, completions } = await attachStepsAndCompletions(assignment);

  return {
    ...mapAssignment(assignment),
    steps,
    completedStepIds: completions.map((c) => c.taskId),
    completions,
  };
}

/**
 * Admin/HR (authenticated) — Progress jadvalida xodim qatoriga bosilganda
 * uning topshirgan barcha vazifalarini ko'rish uchun.
 */
export async function getAssignmentById(id) {
  const [assignment] = (await query(`${SELECT_ASSIGNMENTS} WHERE a.id = $1`, [id])).rows;
  if (!assignment) {
    const error = new Error('Biriktirilgan reja topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const { steps, completions } = await attachStepsAndCompletions(assignment);

  return {
    ...mapAssignment(assignment),
    steps,
    completions,
  };
}

async function recomputeAssignmentCompletion(assignmentId) {
  // "total" must count the same set of tasks as SELECT_ASSIGNMENTS.total_tasks
  // (active tasks, plus any archived one this assignment already completed)
  // — otherwise an edited plan could leave completed_at permanently unset
  // (denominator counts a task the employee can no longer see or submit)
  // or, conversely, mark an assignment "complete" against tasks it never saw.
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM onboarding_step_tasks t
          JOIN onboarding_plan_steps s ON s.id = t.step_id
          JOIN onboarding_assignments a ON a.plan_id = s.plan_id
          WHERE a.id = $1
            AND (t.archived_at IS NULL OR EXISTS (
              SELECT 1 FROM onboarding_step_completions c
              WHERE c.task_id = t.id AND c.assignment_id = $1
            ))) AS total,
       (SELECT COUNT(*) FROM onboarding_step_completions WHERE assignment_id = $1 AND review_status = 'approved') AS done`,
    [assignmentId]
  );
  const { total, done } = result.rows[0];
  const isComplete = Number(total) > 0 && Number(total) === Number(done);
  await query(
    'UPDATE onboarding_assignments SET completed_at = CASE WHEN $2 THEN COALESCE(completed_at, NOW()) ELSE NULL END WHERE id = $1',
    [assignmentId, isComplete]
  );
}

/**
 * Xodim vazifani "topshiradi" — matn, fayl yoki havola sifatida. Bir vazifa
 * qayta topshirilsa (Qayta topshirish), avvalgi topshiriq ustidan yoziladi
 * (assignment_id+task_id UNIQUE bo'ylab UPSERT).
 */
export async function submitTask(token, taskId, submission) {
  const assignmentResult = await query(
    'SELECT id, plan_id, expires_at FROM onboarding_assignments WHERE public_token = $1',
    [token]
  );
  const assignment = assignmentResult.rows[0];
  if (!assignment || (assignment.expires_at && new Date(assignment.expires_at) <= new Date())) {
    const error = new Error('Havola topilmadi yoki eskirgan');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  // archived_at IS NULL — a task HR has removed from the plan should not
  // accept new (or resubmitted) work, even if the employee still has the
  // old link open; it stays visible read-only via their existing completion.
  const taskCheck = await query(
    `SELECT t.id FROM onboarding_step_tasks t
     JOIN onboarding_plan_steps s ON s.id = t.step_id
     WHERE t.id = $1 AND s.plan_id = $2 AND t.archived_at IS NULL`,
    [taskId, assignment.plan_id]
  );
  if (taskCheck.rows.length === 0) {
    const error = new Error('Vazifa topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  // Har bir (qayta) topshiriq HR uchun yangidan ko'rib chiqishni talab
  // qiladi — avval rad etilgan yoki qabul qilingan bo'lsa ham, yangi
  // topshiriq review_status'ni "pending"ga qaytarib, eski HR izohini
  // tozalaydi.
  await query(
    `INSERT INTO onboarding_step_completions
       (assignment_id, task_id, completed_at, submission_type, submission_text, submission_file_url, submission_file_name, submission_link,
        review_status, reviewed_by, reviewed_at, review_comment)
     VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, 'pending', NULL, NULL, NULL)
     ON CONFLICT (assignment_id, task_id) DO UPDATE SET
       completed_at = NOW(),
       submission_type = EXCLUDED.submission_type,
       submission_text = EXCLUDED.submission_text,
       submission_file_url = EXCLUDED.submission_file_url,
       submission_file_name = EXCLUDED.submission_file_name,
       submission_link = EXCLUDED.submission_link,
       review_status = 'pending',
       reviewed_by = NULL,
       reviewed_at = NULL,
       review_comment = NULL`,
    [
      assignment.id,
      taskId,
      submission.type,
      submission.type === 'text' ? submission.text : null,
      submission.type === 'file' ? submission.file?.url || null : null,
      submission.type === 'file' ? submission.file?.name || null : null,
      submission.type === 'link' ? submission.link : null,
    ]
  );

  await recomputeAssignmentCompletion(assignment.id);
  return getAssignmentByToken(token);
}

/**
 * HR vazifa topshirig'ini ko'rib chiqadi — qabul qiladi yoki qaytaradi.
 * Faqat allaqachon topshirilgan (onboarding_step_completions qatori bor)
 * vazifa uchun ishlaydi. Rad etilgan vazifa progress foiziga kirmaydi —
 * xodim uni public sahifada ko'rib, qayta topshirishi kerak bo'ladi.
 */
export async function reviewTaskSubmission(assignmentId, taskId, decision, reviewedBy, comment) {
  const assignmentCheck = await query('SELECT id FROM onboarding_assignments WHERE id = $1', [assignmentId]);
  if (assignmentCheck.rows.length === 0) {
    const error = new Error('Biriktirilgan reja topilmadi');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const result = await query(
    `UPDATE onboarding_step_completions
     SET review_status = $1, reviewed_by = $2, reviewed_at = NOW(), review_comment = $3
     WHERE assignment_id = $4 AND task_id = $5
     RETURNING id`,
    [decision, reviewedBy, comment || null, assignmentId, taskId]
  );
  if (result.rows.length === 0) {
    const error = new Error('Bu vazifa hali topshirilmagan');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  await recomputeAssignmentCompletion(assignmentId);
  return getAssignmentById(assignmentId);
}
