// Server-side initialization
// This file ensures database and cron are initialized when the server starts

let initialized = false;

export async function initializeServer() {
  if (initialized) return;
  
  if (typeof window !== 'undefined') {
    // Client-side, skip
    return;
  }

  try {
    const { initializeSchema, isDatabaseAvailable } = await import('./db');
    const { startCronJob } = await import('./cron');
    
    // Try to initialize schema (will fail gracefully if DB unavailable)
    try {
      await initializeSchema();
    } catch (error: any) {
      console.warn('⚠️  Could not initialize database schema:', error.message);
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.warn('💡 Please check your DATABASE_URL environment variable');
        console.warn('💡 Make sure it does not include quotes: DATABASE_URL=postgresql://...');
      }
    }
    
    // Start cron job (will handle DB unavailability gracefully)
    startCronJob();
    
    initialized = true;
    console.log('✅ Server initialized');
    if (isDatabaseAvailable()) {
      console.log('✅ Database connection available');
    } else {
      console.warn('⚠️  Database not available - app will use API fallback');
    }
  } catch (error: any) {
    console.error('❌ Server initialization failed:', error.message);
  }
}

// Auto-initialize on import (server-side only)
if (typeof window === 'undefined') {
  initializeServer().catch(console.error);
}

