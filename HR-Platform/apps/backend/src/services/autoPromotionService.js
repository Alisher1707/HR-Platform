import { query, getClient } from '../config/database.js';
import { APPLICATION_STATUS } from '../config/constants.js';

/**
 * Auto Promotion Service
 * Automatically converts candidates from SHARTNOMA to employees after 1 hour
 * and removes them from kanban board
 */

/**
 * Process candidates that have been in SHARTNOMA for 1 hour
 * Converts them to employees and removes from board
 */
export async function processAutoPromotions() {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Find candidates in SHARTNOMA for more than 1 hour
    const candidatesResult = await client.query(
      `SELECT a.id, a.employee_id, a.position, a.shartnoma_start_date,
              e.first_name, e.last_name
       FROM applications a
       INNER JOIN employees e ON a.employee_id = e.id
       WHERE a.status = $1
         AND a.shartnoma_start_date IS NOT NULL
         AND a.shartnoma_start_date <= NOW() - INTERVAL '1 hour'
       FOR UPDATE`,
      [APPLICATION_STATUS.SHARTNOMA]
    );

    const candidates = candidatesResult.rows;

    if (candidates.length === 0) {
      await client.query('COMMIT');
      return { processed: 0, candidates: [] };
    }

    console.log(`📋 Found ${candidates.length} candidate(s) ready for auto-promotion`);

    const processed = [];

    for (const candidate of candidates) {
      try {
        // Step 1: Delete application from kanban (candidate is now employee)
        await client.query(
          `DELETE FROM applications WHERE id = $1`,
          [candidate.id]
        );

        // Step 2: Update employee record to mark as hired
        await client.query(
          `UPDATE employees
           SET status = 'Faol',
               join_date = COALESCE(join_date, CURRENT_DATE),
               position = COALESCE(position, $1),
               updated_at = NOW()
           WHERE id = $2`,
          [candidate.position, candidate.employee_id]
        );

        // Step 3: Log history before deletion
        await client.query(
          `INSERT INTO application_history (application_id, changed_by, old_status, new_status, comment)
           VALUES ($1, NULL, $2, NULL, $3)`,
          [
            candidate.id,
            APPLICATION_STATUS.SHARTNOMA,
            '🤖 Avtomatik: 1 soat shartnoma muddati tugadi, xodimga aylantirildi va doskadan olib tashlandi'
          ]
        );

        processed.push({
          id: candidate.id,
          employee_id: candidate.employee_id,
          name: `${candidate.first_name} ${candidate.last_name}`,
          shartnoma_start: candidate.shartnoma_start_date
        });

        console.log(`✅ Auto-promoted: ${candidate.first_name} ${candidate.last_name} (ID: ${candidate.id})`);
      } catch (err) {
        console.error(`❌ Failed to promote candidate ${candidate.id}:`, err.message);
        // Continue with next candidate even if one fails
      }
    }

    await client.query('COMMIT');

    console.log(`🎉 Successfully processed ${processed.length}/${candidates.length} auto-promotions`);

    return {
      processed: processed.length,
      candidates: processed
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Auto-promotion service error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Start the auto-promotion cron job
 * Runs every 5 minutes
 */
export function startAutoPromotionCron() {
  const INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

  console.log('🚀 Starting auto-promotion cron job (runs every 5 minutes)');

  // Run immediately on startup
  processAutoPromotions()
    .then(result => {
      if (result.processed > 0) {
        console.log(`✅ Initial scan: Promoted ${result.processed} candidate(s)`);
      }
    })
    .catch(err => console.error('❌ Initial auto-promotion failed:', err));

  // Then run every 5 minutes
  setInterval(async () => {
    try {
      const result = await processAutoPromotions();
      if (result.processed > 0) {
        console.log(`✅ Cron: Promoted ${result.processed} candidate(s) to employees`);
      }
    } catch (error) {
      console.error('❌ Cron auto-promotion failed:', error);
    }
  }, INTERVAL);
}
