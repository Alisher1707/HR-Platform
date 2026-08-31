import bcrypt from 'bcryptjs';
import { pool, testConnection } from '../config/database.js';

/**
 * Seed database with initial data
 * Creates SUPER_ADMIN and HR users for system initialization
 *
 * SECURITY: credentials are never hardcoded here (a hardcoded default was
 * previously committed to git and documented in README.md, and ended up
 * working unchanged on the production database — see XAVFSIZLIK-AUDIT.md
 * K-1). Both accounts now require their password to be supplied via
 * environment variables, with no fallback, so a fresh environment cannot
 * silently end up with a known/documented password.
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length < 12) {
    throw new Error(
      `${name} muhit o'zgaruvchisi berilmagan yoki juda qisqa (kamida 12 belgi). ` +
      "Seed qilishdan oldin kuchli parol o'rnating, masalan: " +
      `${name}=$(openssl rand -base64 18)`
    );
  }
  return value;
}

async function seed() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Test database connection
    await testConnection();

    const superAdminPassword = requireEnv('SEED_ADMIN_PASSWORD');
    const hrPassword = requireEnv('SEED_HR_PASSWORD');
    const superAdminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@hrplatform.com';
    const hrEmail = process.env.SEED_HR_EMAIL || 'hr@hrplatform.com';

    const insertQuery = `
      INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, role;
    `;

    // 1. Create SUPER_ADMIN user
    const adminHash = await bcrypt.hash(superAdminPassword, 12);
    await pool.query(insertQuery, [superAdminEmail, adminHash, 'SUPER_ADMIN', 'Super', 'Admin', true]);

    // 2. Create HR user
    const hrHash = await bcrypt.hash(hrPassword, 12);
    await pool.query(insertQuery, [hrEmail, hrHash, 'HR', 'HR', 'Manager', true]);

    console.log('✅ Accounts initialized successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Admin Email: ', superAdminEmail);
    console.log('📧 HR Email:    ', hrEmail);
    console.log('(Parollar SEED_ADMIN_PASSWORD/SEED_HR_PASSWORD dan olindi — bu yerda chop etilmaydi)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
