import { query } from '../../config/database.js';

/**
 * Audit Log — read side.
 * Yozish tarafi: ../../services/auditLogService.js#recordAuditEvent
 * (bu yerga aylanma import bo'lmasligi uchun ataylab ajratilgan).
 */
export async function listAuditLogs(filters, pagination) {
  const whereClause = [];
  const params = [];
  let paramCount = 1;

  if (filters.action) {
    whereClause.push(`al.action = $${paramCount}`);
    params.push(filters.action);
    paramCount++;
  }

  if (filters.actorUserId) {
    whereClause.push(`al.actor_user_id = $${paramCount}`);
    params.push(filters.actorUserId);
    paramCount++;
  }

  if (filters.startDate) {
    whereClause.push(`al.created_at >= $${paramCount}`);
    params.push(filters.startDate);
    paramCount++;
  }

  if (filters.endDate) {
    whereClause.push(`al.created_at <= $${paramCount}`);
    params.push(filters.endDate);
    paramCount++;
  }

  const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) as total FROM audit_logs al ${whereString}`, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const page = pagination.page || 1;
  const limit = pagination.limit || 50;
  const offset = (page - 1) * limit;

  const sql = `
    SELECT
      al.id, al.action, al.resource_type, al.resource_id, al.ip_address,
      al.meta, al.created_at,
      al.actor_user_id, al.actor_role,
      u.first_name AS actor_first_name, u.last_name AS actor_last_name, u.email AS actor_email
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_user_id = u.id
    ${whereString}
    ORDER BY al.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;
  params.push(limit, offset);

  const result = await query(sql, params);

  return {
    logs: result.rows.map((row) => ({
      id: row.id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      ipAddress: row.ip_address,
      meta: row.meta,
      createdAt: row.created_at,
      actor: row.actor_user_id ? {
        id: row.actor_user_id,
        role: row.actor_role,
        firstName: row.actor_first_name,
        lastName: row.actor_last_name,
        email: row.actor_email,
      } : { id: null, role: row.actor_role, firstName: null, lastName: null, email: null },
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
