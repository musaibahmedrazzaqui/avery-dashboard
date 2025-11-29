// This file ensures database schema is initialized on app startup
import { initializeSchema } from './db';
import { startCronJob } from './cron';

let initialized = false;

export async function initializeDatabase() {
  if (initialized) return;
  
  try {
    await initializeSchema();
    startCronJob();
    initialized = true;
    console.log('✅ Database and cron job initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Auto-initialize if this is a server-side context
if (typeof window === 'undefined') {
  initializeDatabase().catch(console.error);
}

