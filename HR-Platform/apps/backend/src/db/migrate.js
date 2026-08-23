import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, testConnection } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run database migrations
 *
 * Bajarilgan migratsiyalar `schema_migrations` jadvalida kuzatiladi —
 * har fayl faqat BIR MARTA ishga tushadi, undan keyingi deploy'larda
 * o'tkazib yuboriladi. Bu ayniqsa muhim: ba'zi eski migratsiyalar
 * (masalan 017, 045) haqiqiy UPDATE/INSERT operatsiyalari — agar ular
 * har deploy'da qayta ishga tushsa, HR qo'lda o'zgartirgan qiymatlarni
 * jimgina qaytarib qo'yishi mumkin edi.
 *
 * Mavjud (eski) production bazalar uchun: agar schema_migrations bo'sh
 * bo'lsa-yu, lekin `users` jadvali allaqachon mavjud bo'lsa — bu yangi
 * baza emas, balki eski tizimdan o'tayotgan baza. Bunday holda barcha
 * joriy migratsiya fayllari "allaqachon bajarilgan" deb belgilanadi
 * (haqiqatan qayta ishga tushirilmasdan) — shundan keyin faqat YANGI
 * qo'shiladigan migratsiyalar oddiy tartibda ishlaydi.
 */
async function migrate() {
  console.log('🚀 Starting database migration...\n');

  try {
    await testConnection();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    VARCHAR(255) PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((file) => file.endsWith('.sql')).sort();

    const appliedResult = await pool.query('SELECT filename FROM schema_migrations');
    const alreadyApplied = new Set(appliedResult.rows.map((r) => r.filename));

    if (alreadyApplied.size === 0) {
      const usersTableExists = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'users'
        ) AS exists
      `);

      if (usersTableExists.rows[0].exists) {
        console.log(
          `📌 Eski (bootstrap) baza aniqlandi — joriy ${sqlFiles.length} ta migratsiya ` +
          `qayta ishga tushirilmasdan "bajarilgan" deb belgilanadi.\n`
        );
        for (const file of sqlFiles) {
          await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          );
          alreadyApplied.add(file);
        }
        console.log('✅ Bootstrap tugadi. Bundan keyin faqat yangi migratsiyalar ishga tushadi.\n');
      }
    }

    const pending = sqlFiles.filter((file) => !alreadyApplied.has(file));
    console.log(`Found ${sqlFiles.length} migration files — ${pending.length} ta yangi bajariladi:\n`);

    if (pending.length === 0) {
      console.log('✅ Barcha migratsiyalar allaqachon bajarilgan — hech narsa qilinmadi.');
    }

    for (const file of pending) {
      console.log(`📄 Executing: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      try {
        await pool.query(sql);
        console.log(`✅ Success: ${file}`);
      } catch (error) {
        // Obyekt allaqachon mavjudligi xatosi — eski (schema_migrations'siz)
        // deploy'lardan qolgan holatlar uchun xavfsizlik chorasi sifatida
        // saqlanadi, lekin endi bootstrap tufayli deyarli hech qachon
        // ishga tushmaydi.
        if (error.code === '42P07' || error.code === '42710' || error.code === '42701') {
          console.log(`⚠️  Warning: ${file} - Objects already exist, skipping...`);
        } else {
          throw error;
        }
      }

      await pool.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [file]
      );
      console.log('');
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrate();
