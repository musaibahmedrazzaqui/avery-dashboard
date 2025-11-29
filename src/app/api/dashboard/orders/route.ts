import { NextRequest, NextResponse } from 'next/server';
import { query, isDatabaseAvailable } from '@/lib/db';

/**
 * GET /api/dashboard/orders - Get orders from database
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured', orders: [] },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const storeType = searchParams.get('store_type');
    const storeName = searchParams.get('store_name') || searchParams.get('store');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const page = parseInt(searchParams.get('page') || '1');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const fulfillmentStatus = searchParams.get('fulfillment_status') || status;

    // Calculate offset from page if provided
    const actualOffset = page > 1 ? (page - 1) * limit : offset;

    let sql = `
      SELECT 
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
        synced_at
      FROM dashboard.orders
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (storeType) {
      sql += ` AND store_type = $${paramIndex}`;
      params.push(storeType);
      paramIndex++;
    }

    if (storeName && storeName !== 'All') {
      sql += ` AND store_name = $${paramIndex}`;
      params.push(storeName);
      paramIndex++;
    }

    if (dateFrom) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    if (fulfillmentStatus && fulfillmentStatus !== 'all') {
      sql += ` AND LOWER(fulfillment_status) = LOWER($${paramIndex})`;
      params.push(fulfillmentStatus);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (
        order_number ILIKE $${paramIndex} OR
        buyer_username ILIKE $${paramIndex} OR
        buyer_email ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count for pagination (build count query separately with proper parameterization)
    let countSql = `SELECT COUNT(*) as total FROM dashboard.orders WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIndex = 1;
    
    if (storeType) {
      countSql += ` AND store_type = $${countParamIndex}`;
      countParams.push(storeType);
      countParamIndex++;
    }
    if (storeName && storeName !== 'All') {
      countSql += ` AND store_name = $${countParamIndex}`;
      countParams.push(storeName);
      countParamIndex++;
    }
    if (dateFrom) {
      countSql += ` AND created_at >= $${countParamIndex}`;
      countParams.push(dateFrom);
      countParamIndex++;
    }
    if (dateTo) {
      countSql += ` AND created_at <= $${countParamIndex}`;
      countParams.push(dateTo);
      countParamIndex++;
    }
    if (fulfillmentStatus && fulfillmentStatus !== 'all') {
      countSql += ` AND LOWER(fulfillment_status) = LOWER($${countParamIndex})`;
      countParams.push(fulfillmentStatus);
      countParamIndex++;
    }
    if (search) {
      countSql += ` AND (
        order_number ILIKE $${countParamIndex} OR
        buyer_username ILIKE $${countParamIndex} OR
        buyer_email ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    
    const countResult = await query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].total) || 0;

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, actualOffset);

    const result = await query(sql, params);

    // Transform to match expected format
    const orders = result.rows.map((row) => ({
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
    }));

    // Return pagination metadata
    return NextResponse.json({
      orders,
      pagination: {
        total: totalCount,
        limit,
        offset: actualOffset,
        hasMore: actualOffset + limit < totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page || Math.floor(actualOffset / limit) + 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

