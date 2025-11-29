import { NextRequest, NextResponse } from 'next/server';
import { syncAllStores } from '@/lib/sync/sync-service';

/**
 * Manual sync endpoint
 * POST /api/sync - Trigger manual sync
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const isInitialSync = body.initialSync === true;

    console.log(`🔄 Manual sync triggered (${isInitialSync ? 'FULL HISTORICAL' : 'daily'})`);
    
    // If full historical sync, ensure we don't duplicate
    if (isInitialSync) {
      const { isDatabaseAvailable, query } = await import('@/lib/db');
      if (isDatabaseAvailable()) {
        // Check if we should clean first (optional - user can decide)
        // For now, we'll just sync and let ON CONFLICT handle duplicates
        console.log('📦 Full historical sync - will update existing records');
      }
    }
    
    const result = await syncAllStores(isInitialSync);

    return NextResponse.json({
      success: result.success,
      totalOrdersSynced: result.totalOrdersSynced,
      totalProductsSynced: result.totalProductsSynced,
      totalCustomersSynced: result.totalCustomersSynced,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Error in manual sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync - Get sync status
 */
export async function GET() {
  try {
    const { query, isDatabaseAvailable } = await import('@/lib/db');
    
    if (!isDatabaseAvailable()) {
      return NextResponse.json({
        stores: [],
        error: 'Database not configured',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await query(`
      SELECT 
        store_type,
        store_name,
        COUNT(*) as order_count,
        MAX(synced_at) as last_synced
      FROM dashboard.orders
      GROUP BY store_type, store_name
      ORDER BY store_type, store_name
    `);

    return NextResponse.json({
      stores: result.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        stores: [],
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

