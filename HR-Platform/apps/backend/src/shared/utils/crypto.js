import crypto from 'crypto';

/**
 * Crypto Utilities
 * Helper functions for cryptographic operations
 */

/**
 * Generate random invite token
 * Creates a URL-safe random token for invite links
 */
export function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate random string
 */
export function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash string using SHA256
 */
export function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Generate secure random number
 */
export function generateRandomNumber(min = 0, max = 1000000) {
  const range = max - min;
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0) / 0xffffffff;
  return Math.floor(randomNumber * range) + min;
}

// Ambiguous-looking characters (0/O, 1/I/L) removed — this code gets read
// aloud/typed by hand (HR tells the employee the code, or the employee
// types it into Telegram).
const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a short, hand-typeable code (e.g. for linking a Telegram chat
 * to an employee record).
 */
export function generateLinkCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += LINK_CODE_ALPHABET[bytes[i] % LINK_CODE_ALPHABET.length];
  }
  return code;
}
