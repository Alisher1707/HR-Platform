import bcrypt from 'bcryptjs';
import { query, getClient } from '../../config/database.js';
import { generateTokenPair, verifyRefreshToken } from '../../shared/utils/token.js';
import { HTTP_STATUS, MESSAGES } from '../../config/constants.js';
import { getNextAutoPersonId } from '../employees/employees.service.js';

/**
 * Auth Service
 * Handles authentication business logic
 */

const SALT_ROUNDS = 12;

/**
 * Login user
 */
export async function loginUser(email, password) {
  // Find user by email
  const result = await query(
    'SELECT id, email, password_hash, role, first_name, last_name, is_active FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    const error = new Error(MESSAGES.AUTH_FAILED);
    error.statusCode = HTTP_STATUS.UNAUTHORIZED;
    throw error;
  }

  const user = result.rows[0];

  // Check if user is active
  if (!user.is_active) {
    const error = new Error('Account is deactivated');
    error.statusCode = HTTP_STATUS.FORBIDDEN;
    throw error;
  }

  // Verify password
  console.log('Login attempt:', { email, password, hash: user.password_hash });
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  console.log('Password valid:', isPasswordValid);

  if (!isPasswordValid) {
    const error = new Error(MESSAGES.AUTH_FAILED);
    error.statusCode = HTTP_STATUS.UNAUTHORIZED;
    throw error;
  }

  // Generate tokens
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Remove password_hash from response
  delete user.password_hash;

  return {
    user,
    tokens,
  };
}

/**
 * Register user with invite token
 */
export async function registerUser(inviteToken, userData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Validate invite token
    const inviteResult = await client.query(
      `SELECT id, expires_at, used_at, is_active, position, requirements, created_by
       FROM invites
       WHERE token = $1`,
      [inviteToken]
    );

    if (inviteResult.rows.length === 0) {
      const error = new Error(MESSAGES.INVITE_INVALID);
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const invite = inviteResult.rows[0];

    // Check if already used
    if (invite.used_at) {
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

    // Check if email already exists
    const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [userData.email]);

    if (emailCheck.rows.length > 0) {
      const error = new Error(MESSAGES.USER_EXISTS);
      error.statusCode = HTTP_STATUS.CONFLICT;
      throw error;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);

    // Create user
    // NOTE: role is intentionally never taken from client-supplied userData —
    // that would let anyone registering via a link self-assign a role,
    // including ADMIN. A position-bearing invite (candidate/job invite,
    // creatable by HR too) always resolves to EMPLOYEE. A position-less
    // invite is a staff invite that only SUPER_ADMIN can create in the first
    // place (enforced in invite.controller.js#createInvite), so defaulting
    // it to ADMIN here is safe.
    const userRole = invite.position ? 'EMPLOYEE' : 'ADMIN';

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, first_name, last_name, is_active, created_at`,
      [userData.email, passwordHash, userRole, userData.firstName, userData.lastName]
    );

    const user = userResult.rows[0];

    // Automatically create employee and application records if a position is set
    if (invite.position) {
      const personId = await getNextAutoPersonId(client);
      const employeeResult = await client.query(
        `INSERT INTO employees (first_name, last_name, person_id, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [user.first_name, user.last_name, personId, invite.created_by]
      );
      const employeeId = employeeResult.rows[0].id;

      const notes = invite.requirements
        ? (typeof invite.requirements === 'string'
            ? invite.requirements
            : JSON.stringify(invite.requirements))
        : null;

      const applicationResult = await client.query(
        `INSERT INTO applications (employee_id, status, position, notes, order_index)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [employeeId, 'KELDI', invite.position, notes, 0]
      );
      const applicationId = applicationResult.rows[0].id;

      await client.query(
        `INSERT INTO application_history (application_id, changed_by, new_status, comment)
         VALUES ($1, $2, $3, $4)`,
        [applicationId, invite.created_by, 'KELDI', `Taklifnoma orqali ro'yxatdan o'tdi. Lavozim: ${invite.position}`]
      );
    }

    // Mark invite as used
    await client.query(
      'UPDATE invites SET used_at = NOW(), used_by = $1 WHERE id = $2',
      [user.id, invite.id]
    );

    await client.query('COMMIT');

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user,
      tokens,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken) {
  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user from database
    const result = await query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      const error = new Error(MESSAGES.USER_NOT_FOUND);
      error.statusCode = HTTP_STATUS.UNAUTHORIZED;
      throw error;
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      const error = new Error('Account is deactivated');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return tokens;
  } catch (error) {
    if (error.message === 'Refresh token expired') {
      const err = new Error(MESSAGES.TOKEN_EXPIRED);
      err.statusCode = HTTP_STATUS.UNAUTHORIZED;
      throw err;
    }
    if (error.message === 'Invalid refresh token') {
      const err = new Error(MESSAGES.TOKEN_INVALID);
      err.statusCode = HTTP_STATUS.UNAUTHORIZED;
      throw err;
    }
    throw error;
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(userId) {
  const result = await query(
    'SELECT id, email, role, first_name, last_name, is_active, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    const error = new Error(MESSAGES.USER_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  return result.rows[0];
}
