import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../shared/utils/token.js';

/**
 * Refresh Token Lifecycle
 *
 * Refresh tokens are still JWTs (self-contained, verified offline like
 * before) but each one now also gets a row in `refresh_tokens`, keyed by
 * a random `jti` embedded in the token payload. That row is what makes a
 * token revocable: logout, or a future "sign this user out everywhere"
 * action, just has to flip `revoked_at` — no need to invalidate every
 * token in existence by rotating JWT_REFRESH_SECRET.
 *
 * Every refresh also rotates: the presented token's row is marked
 * revoked, and a brand-new token/row pair is issued. A later attempt to
 * reuse an already-revoked refresh token is rejected outright — that's
 * also the shape of a stolen-token replay, so this is a real (if basic)
 * theft signal, not just cleanup.
 */

/**
 * Issues a fresh access+refresh token pair for a user and records the
 * refresh token's row. `client` may be a transaction client (registration
 * inserts this in the same transaction as the new user) or the plain pool.
 */
export async function issueTokenPair(dbClient, userPayload) {
  const accessToken = generateAccessToken(userPayload);

  const jti = crypto.randomUUID();
  const refreshToken = generateRefreshToken({ ...userPayload, jti });
  const { exp } = jwt.decode(refreshToken);

  await dbClient.query(
    'INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES ($1, $2, to_timestamp($3))',
    [jti, userPayload.userId, exp]
  );

  return { accessToken, refreshToken };
}

/**
 * Verifies a refresh token both cryptographically (signature/expiry) and
 * against its DB row (exists, not revoked) — then rotates it: the old row
 * is revoked and a new token pair is issued and recorded. Throws with the
 * same `.message` values `auth.service.js`'s callers already expect
 * ('Refresh token expired' / 'Invalid refresh token') so existing error
 * mapping keeps working unchanged.
 */
export async function rotateRefreshToken(dbClient, refreshToken) {
  const decoded = verifyRefreshToken(refreshToken); // throws on bad signature/expiry

  const result = await dbClient.query(
    'SELECT user_id, revoked_at FROM refresh_tokens WHERE id = $1',
    [decoded.jti]
  );

  if (result.rows.length === 0) {
    // Predates this migration, or already cleaned up — not attributable to
    // a user, nothing further to revoke.
    throw new Error('Invalid refresh token');
  }

  if (result.rows[0].revoked_at) {
    // XAVFSIZLIK-AUDIT.md O-13: an already-revoked token being presented
    // again means one of two things happened to this exact token — either
    // the legitimate client retried a request whose response it never saw
    // (harmless), or someone else got hold of the token and the real owner
    // already rotated past it (theft). There's no way to tell those apart
    // from here, so this is treated as a theft signal: EVERY refresh token
    // this user currently holds is revoked, forcing every session
    // (attacker's and the legitimate one) to log in again. Previously only
    // this one replay attempt was rejected — the rest of the "family"
    // (including whichever token the attacker was actually using) stayed
    // valid.
    await dbClient.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [result.rows[0].user_id]
    );
    throw new Error('Invalid refresh token');
  }

  await dbClient.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [decoded.jti]);

  return decoded;
}

/**
 * Revokes one refresh token by its raw JWT value — used by logout.
 *
 * XAVFSIZLIK-AUDIT.md O-14: this used to `jwt.decode()` the token —
 * decode never checks the signature, so any well-formed-but-unsigned/
 * forged JWT with a guessed or observed `jti` would revoke that session.
 * `verifyRefreshToken` is used instead (throws on a bad signature), and
 * the caller now must also supply the authenticated requester's own user
 * id so a valid-but-someone-else's refresh token can't be logged out
 * either.
 */
export async function revokeRefreshToken(dbClient, refreshToken, requestingUserId = null) {
  if (!refreshToken) return;
  try {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded?.jti) return;
    if (requestingUserId && decoded.userId !== requestingUserId) return;
    await dbClient.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL',
      [decoded.jti]
    );
  } catch {
    // Malformed/invalid/expired token on logout — nothing to revoke, nothing to fail on.
  }
}

/** Revokes every refresh token currently issued to a user — used after a password change (O-9) and for a future "sign out everywhere" action. */
export async function revokeAllUserRefreshTokens(dbClient, userId) {
  await dbClient.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

/**
 * Every row here (rotated-away, logged-out, or simply expired) is
 * permanently useless the moment it's past `expires_at` — nothing ever
 * needs to read it again, so the table would otherwise grow forever at
 * roughly one row per login/refresh, indefinitely.
 */
export async function cleanupExpiredRefreshTokens(dbClient) {
  const result = await dbClient.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  return result.rowCount;
}

export function startRefreshTokenCleanupCron(dbClient) {
  const INTERVAL = 24 * 60 * 60 * 1000; // kuniga bir marta
  setInterval(async () => {
    try {
      const deleted = await cleanupExpiredRefreshTokens(dbClient);
      if (deleted > 0) {
        console.log(`🧹 Eskirgan refresh tokenlar tozalandi: ${deleted} ta`);
      }
    } catch (error) {
      console.error('❌ Refresh token tozalash xatosi:', error.message);
    }
  }, INTERVAL);
}
