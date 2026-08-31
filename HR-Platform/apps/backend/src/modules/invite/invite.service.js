import fs from 'fs/promises';
import { query, getClient } from '../../config/database.js';
import { generateInviteToken } from '../../shared/utils/crypto.js';
import { config } from '../../config/env.js';
import { HTTP_STATUS, MESSAGES, USER_ROLES } from '../../config/constants.js';

/**
 * Invite Service
 * Handles invite token business logic
 */

/**
 * Create invite token
 */
export async function createInvite(createdBy, position = null, requirements = null) {
  // Generate unique token
  const token = generateInviteToken();

  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.invite.expiresInDays);

  // Insert into database
  const result = await query(
    `INSERT INTO invites (token, created_by, expires_at, is_active, position, requirements)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, token, expires_at, is_active, created_at, position, requirements`,
    [token, createdBy, expiresAt, true, position, requirements ? JSON.stringify(requirements) : null]
  );

  const invite = result.rows[0];

  // Generate invite URL
  const inviteUrl = `${config.frontendUrl}/apply?token=${token}`;

  return {
    ...invite,
    invite_url: inviteUrl,
  };
}

/**
 * A raw invite token IS a password-equivalent bearer credential — whoever
 * has it can POST /auth/register with it and, for a position-less invite,
 * walk away with an ADMIN account (see invite.controller#createInvite's
 * own SUPER_ADMIN-only guard on minting those). Listing/detail endpoints
 * must never hand the raw token to a caller who isn't allowed to mint that
 * same kind of invite themselves — otherwise the guard on creation is
 * pointless, since HR could simply read a SUPER_ADMIN-created one back out
 * (XAVFSIZLIK-AUDIT.md K-5). Masking (not just omitting) still lets HR
 * visually confirm which row is which without handing over anything usable.
 */
function maskToken(token) {
  if (!token) return token;
  return `${token.slice(0, 8)}…`;
}

function canSeeFullInvite(invite, requestingRole) {
  // Only a position-less invite (=> registers ADMIN, see auth.service.js)
  // needs restricting. A candidate invite (position set) always resolves
  // to the low-privilege EMPLOYEE role, so HR seeing/sharing its real
  // token with a candidate is the whole point of the feature.
  return requestingRole === USER_ROLES.SUPER_ADMIN || !!invite.position;
}

/**
 * Get all invites
 */
export async function getAllInvites(filters = {}, requestingRole = null) {
  let whereClause = [];
  let params = [];
  let paramCount = 1;

  // Build WHERE clause dynamically
  if (filters.isActive !== undefined) {
    whereClause.push(`i.is_active = $${paramCount}`);
    params.push(filters.isActive);
    paramCount++;
  }

  if (filters.createdBy) {
    whereClause.push(`i.created_by = $${paramCount}`);
    params.push(filters.createdBy);
    paramCount++;
  }

  // Defense in depth, at the query level rather than just the response
  // shape: anyone below SUPER_ADMIN never even receives an ADMIN-granting
  // invite row at all, masked or not.
  if (requestingRole !== USER_ROLES.SUPER_ADMIN) {
    whereClause.push(`i.position IS NOT NULL`);
  }

  const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  const sql = `
    SELECT
      i.id,
      i.token,
      i.created_by,
      i.used_by,
      i.expires_at,
      i.used_at,
      i.is_active,
      i.created_at,
      i.position,
      i.requirements,
      creator.first_name as creator_first_name,
      creator.last_name as creator_last_name,
      creator.email as creator_email,
      usedby.first_name as used_by_first_name,
      usedby.last_name as used_by_last_name,
      usedby.email as used_by_email
    FROM invites i
    LEFT JOIN users creator ON i.created_by = creator.id
    LEFT JOIN users usedby ON i.used_by = usedby.id
    ${whereString}
    ORDER BY i.created_at DESC
  `;

  const result = await query(sql, params);

  // Format response
  return result.rows.map((row) => {
    const full = canSeeFullInvite(row, requestingRole);
    return {
    id: row.id,
    token: full ? row.token : maskToken(row.token),
    expires_at: row.expires_at,
    used_at: row.used_at,
    is_active: row.is_active,
    created_at: row.created_at,
    position: row.position,
    requirements: row.requirements,
    invite_url: full ? `${config.frontendUrl}/apply?token=${row.token}` : null,
    is_expired: new Date(row.expires_at) < new Date(),
    is_used: !!row.used_at,
    created_by: row.created_by ? {
      id: row.created_by,
      first_name: row.creator_first_name,
      last_name: row.creator_last_name,
      email: row.creator_email,
    } : null,
    used_by: row.used_by ? {
      id: row.used_by,
      first_name: row.used_by_first_name,
      last_name: row.used_by_last_name,
      email: row.used_by_email,
    } : null,
    };
  });
}

/**
 * Get invite by ID
 */
export async function getInviteById(id, requestingRole = null) {
  const result = await query(
    `SELECT
      i.id,
      i.token,
      i.created_by,
      i.used_by,
      i.expires_at,
      i.used_at,
      i.is_active,
      i.created_at,
      i.position,
      i.requirements,
      creator.first_name as creator_first_name,
      creator.last_name as creator_last_name,
      usedby.first_name as used_by_first_name,
      usedby.last_name as used_by_last_name
    FROM invites i
    LEFT JOIN users creator ON i.created_by = creator.id
    LEFT JOIN users usedby ON i.used_by = usedby.id
    WHERE i.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    const error = new Error('Invite not found');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  const row = result.rows[0];

  // Same reasoning as getAllInvites: an ADMIN-granting (position-less)
  // invite's real token must never reach anyone but SUPER_ADMIN, including
  // by direct id lookup. Responds identically to "not found" rather than
  // e.g. 403, so a non-SUPER_ADMIN can't even confirm such an invite id
  // exists (XAVFSIZLIK-AUDIT.md K-5).
  if (!canSeeFullInvite(row, requestingRole)) {
    const error = new Error('Invite not found');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  return {
    id: row.id,
    token: row.token,
    expires_at: row.expires_at,
    used_at: row.used_at,
    is_active: row.is_active,
    created_at: row.created_at,
    position: row.position,
    requirements: row.requirements,
    invite_url: `${config.frontendUrl}/apply?token=${row.token}`,
    is_expired: new Date(row.expires_at) < new Date(),
    is_used: !!row.used_at,
    created_by: row.created_by ? {
      id: row.created_by,
      first_name: row.creator_first_name,
      last_name: row.creator_last_name,
    } : null,
    used_by: row.used_by ? {
      id: row.used_by,
      first_name: row.used_by_first_name,
      last_name: row.used_by_last_name,
    } : null,
  };
}

/**
 * Validate invite token
 */
export async function validateInviteToken(token) {
  const result = await query(
    `SELECT id, token, expires_at, used_at, is_active, position, requirements
     FROM invites
     WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return {
      valid: false,
      message: MESSAGES.INVITE_INVALID,
    };
  }

  const invite = result.rows[0];

  // Check if already used (only for registration invites without position)
  if (invite.used_at && !invite.position) {
    return {
      valid: false,
      message: MESSAGES.INVITE_USED,
    };
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    return {
      valid: false,
      message: MESSAGES.INVITE_EXPIRED,
    };
  }

  // Check if active
  if (!invite.is_active) {
    return {
      valid: false,
      message: MESSAGES.INVITE_INVALID,
    };
  }

  return {
    valid: true,
    message: 'Invite is valid',
    invite: {
      id: invite.id,
      token: invite.token,
      expires_at: invite.expires_at,
      position: invite.position,
      requirements: invite.requirements,
    },
  };
}

/**
 * Submit application using invite token
 * @param {object} applicationData - Candidate form fields
 * @param {object|null} resumeFile - Multer file object (candidate resume), optional
 */
export async function submitApplication(applicationData, resumeFile = null) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Validate invite token.
    // XAVFSIZLIK-AUDIT.md (2-pass, poyga sharoiti #2): `FOR UPDATE` —
    // auth.service.js#registerUser'dagi bir xil tuzatish, himoya
    // maqsadida shu yerga ham qo'llanildi (lavozimli taklifnomalar
    // ataylab qayta ishlatiladigan bo'lsa-da, qulflash ularga hech qanday
    // yon ta'sir qilmaydi — faqat lavozimsiz yo'l uchun muhim).
    const inviteResult = await client.query(
      `SELECT id, expires_at, used_at, is_active, position, requirements, created_by
       FROM invites
       WHERE token = $1
       FOR UPDATE`,
      [applicationData.token]
    );

    if (inviteResult.rows.length === 0) {
      const error = new Error(MESSAGES.INVITE_INVALID);
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const invite = inviteResult.rows[0];

    // Check if already used (only for registration invites without position)
    if (invite.used_at && !invite.position) {
      const error = new Error(MESSAGES.INVITE_USED);
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      const error = new Error(MESSAGES.INVITE_EXPIRED);
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    // Check if not active
    if (!invite.is_active) {
      const error = new Error(MESSAGES.INVITE_INVALID);
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    // 2. Insert employee as candidate ('Nomzod')
    // Xodimlar bo'limida ko'rinmaydi — SHARTNOMA bosqichiga o'tganda 'Faol' bo'ladi.
    // person_id (kamera identifikatori) qasddan bu yerda berilmaydi — hali
    // ishga qabul qilinmagan har bir arizachiga kamera/bino kirish ID
    // berishning ma'nosi yo'q. U SHARTNOMA bosqichida (applications.service.js)
    // avtomatik beriladi.
    const employeeResult = await client.query(
      `INSERT INTO employees (first_name, last_name, phone, address, birth_date, experience, telegram_username, resume_url, resume_original_name, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        applicationData.firstName,
        applicationData.lastName,
        applicationData.phone,
        applicationData.address || null,
        applicationData.birthDate,
        applicationData.experience,
        applicationData.telegramUsername || null,
        resumeFile ? `/uploads/resumes/${resumeFile.filename}` : null,
        resumeFile ? resumeFile.originalname : null,
        'Nomzod',
        invite.created_by
      ]
    );
    const employeeId = employeeResult.rows[0].id;

    // 3. Create application record
    const applicationResult = await client.query(
      `INSERT INTO applications (employee_id, status, position, notes, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        employeeId,
        'KELDI',
        invite.position || 'Kiritilmagan',
        applicationData.notes || null,
        0
      ]
    );
    const applicationId = applicationResult.rows[0].id;

    // 4. Create history record
    await client.query(
      `INSERT INTO application_history (application_id, changed_by, new_status, comment)
       VALUES ($1, $2, $3, $4)`,
      [
        applicationId,
        invite.created_by,
        'KELDI',
        `Nomzod taklifnoma orqali ariza topshirdi. Lavozim: ${invite.position || 'Kiritilmagan'}`
      ]
    );

    // 5. Mark invite as used (only deactivate if it has no position)
    if (!invite.position) {
      await client.query(
        'UPDATE invites SET used_at = NOW(), is_active = false WHERE id = $1',
        [invite.id]
      );
    } else {
      await client.query(
        'UPDATE invites SET used_at = NOW() WHERE id = $1',
        [invite.id]
      );
    }

    await client.query('COMMIT');

    return {
      success: true,
      employeeId,
      applicationId
    };
  } catch (error) {
    await client.query('ROLLBACK');

    // Ariza saqlanmadi — yuklangan rezyume faylini ham tozalab qo'yamiz
    if (resumeFile) {
      try {
        await fs.unlink(resumeFile.path);
      } catch (unlinkError) {
        console.error('Failed to clean up resume file:', unlinkError.message);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Deactivate invite
 */
export async function deactivateInvite(id) {
  const result = await query(
    'UPDATE invites SET is_active = false WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rows.length === 0) {
    const error = new Error('Invite not found');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  return { id: result.rows[0].id };
}

/**
 * Delete invite
 */
export async function deleteInvite(id) {
  const result = await query('DELETE FROM invites WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    const error = new Error('Invite not found');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  return { id: result.rows[0].id };
}
