import { NextResponse } from 'next/server';
import { initializeSchema } from '@/lib/db';
import { startCronJob } from '@/lib/cron';
import { syncAllStores } from '@/lib/sync/sync-service';

/**
 * Initialize database and run initial sync
 * GET /api/init
 */
export async function GET() {
  try {
    // Initialize schema
    await initializeSchema();
    console.log('✅ Database schema initialized');

    // Start cron job
    startCronJob();
    console.log('✅ Cron job started');

    // Check if we need initial sync
    const { query } = await import('@/lib/db');
    const result = await query('SELECT COUNT(*) as count FROM dashboard.orders');
    const count = parseInt(result.rows[0].count);

    if (count === 0) {
      console.log('📦 Running initial sync...');
      const syncResult = await syncAllStores(true);
      return NextResponse.json({
        success: true,
        message: 'Database initialized and initial sync completed',
        ordersSynced: syncResult.totalOrdersSynced,
        errors: syncResult.errors,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Database already initialized',
      existingOrders: count,
    });
  } catch (error: any) {
    console.error('❌ Initialization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

