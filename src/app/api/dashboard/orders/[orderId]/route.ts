import { NextRequest, NextResponse } from 'next/server';
import { query, isDatabaseAvailable } from '@/lib/db';

/**
 * GET /api/dashboard/orders/[orderId] - Get order details from database
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    let orderId = params.orderId;
    
    // Decode URL-encoded order ID
    orderId = decodeURIComponent(orderId);

    // Query order from database
    const result = await query(
      `SELECT 
        order_id,
        store_type,
        store_name,
        order_number,
        total_price,
        created_at,
        fulfillment_status,
        financial_status,
        order_status,
        buyer_username,
        buyer_email,
        shipping_address,
        line_items,
        raw_data,
        synced_at
      FROM dashboard.orders
      WHERE order_id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Transform to match expected format
    const order = {
      id: row.order_id,
      order_number: row.order_number,
      total_price: row.total_price.toString(),
      created_at: row.created_at.toISOString(),
      fulfillment_status: row.fulfillment_status,
      financial_status: row.financial_status,
      order_status: row.order_status,
      line_items: row.line_items || [],
      customer: row.buyer_username || row.buyer_email
        ? {
            first_name: row.buyer_username?.split(' ')[0] || '',
            last_name: row.buyer_username?.split(' ').slice(1).join(' ') || '',
            email: row.buyer_email || '',
          }
        : null,
      shipping_address: row.shipping_address || null,
      tags: [],
      store: row.store_name,
      store_type: row.store_type,
      raw_data: row.raw_data || null, // Include raw data for full details
    };

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Error fetching order details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

