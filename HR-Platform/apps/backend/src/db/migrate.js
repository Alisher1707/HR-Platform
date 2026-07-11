import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, testConnection } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run database migrations
 * Executes all SQL files in the migrations folder in order
 */
async function migrate() {
  console.log('🚀 Starting database migration...\n');

  try {
    // Test database connection
    await testConnection();

    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter((file) => file.endsWith('.sql'))
      .sort(); // Sort alphabetically to ensure order

    console.log(`Found ${sqlFiles.length} migration files:\n`);

    // Execute each migration file
    for (const file of sqlFiles) {
      console.log(`📄 Executing: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      try {
        await pool.query(sql);
        console.log(`✅ Success: ${file}\n`);
      } catch (error) {
        // Check if error is because object already exists
        if (error.code === '42P07' || error.code === '42710' || error.code === '42701') {
          console.log(`⚠️  Warning: ${file} - Objects already exist, skipping...\n`);
        } else {
          throw error;
        }
      }
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
