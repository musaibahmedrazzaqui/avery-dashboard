import cron from 'node-cron';
import { syncAllStores } from './sync/sync-service';
import { initializeSchema } from './db';

let cronJob: cron.ScheduledTask | null = null;

/**
 * Initialize and start the cron job
 * Runs daily at 12 PM (noon)
 * Note: Initial sync must be triggered manually via dashboard button
 */
export function startCronJob() {
  // Initialize schema on startup
  initializeSchema()
    .catch((error) => {
      console.error('Failed to initialize database schema:', error);
    });

  // Schedule daily sync at 12 PM (noon)
  cronJob = cron.schedule('0 12 * * *', async () => {
    console.log('⏰ Daily sync triggered at', new Date().toISOString());
    try {
      await syncAllStores(false);
    } catch (error) {
      console.error('❌ Error in daily sync:', error);
    }
  });

  console.log('✅ Cron job scheduled: Daily sync at 12 PM (noon)');
  console.log('ℹ️  Initial sync must be triggered manually via the dashboard button');
}


/**
 * Stop the cron job
 */
export function stopCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('⏹️  Cron job stopped');
  }
}

