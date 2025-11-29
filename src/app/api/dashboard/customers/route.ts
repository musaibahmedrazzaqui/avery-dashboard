import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/dashboard/customers - Get customers from database
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const storeType = searchParams.get('store_type');
    const storeName = searchParams.get('store_name') || searchParams.get('store');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort');

    // Calculate offset from page if provided
    const actualOffset = page > 1 ? (page - 1) * limit : offset;

    let sql = `
      SELECT 
        customer_id,
        store_type,
        store_name,
        first_name,
        last_name,
        email,
        orders_count,
        total_spent,
        tags,
        addresses,
        synced_at
      FROM dashboard.customers
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

    if (search) {
      sql += ` AND (
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as total FROM dashboard.customers WHERE 1=1`;
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
    if (search) {
      countSql += ` AND (
        first_name ILIKE $${countParamIndex} OR
        last_name ILIKE $${countParamIndex} OR
        email ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    
    const countResult = await query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].total) || 0;

    // Handle sorting
    let orderBy = 'synced_at DESC';
    if (sort) {
      if (sort === 'spent_desc') orderBy = 'total_spent DESC';
      else if (sort === 'spent_asc') orderBy = 'total_spent ASC';
      else if (sort === 'orders_desc') orderBy = 'orders_count DESC';
      else if (sort === 'orders_asc') orderBy = 'orders_count ASC';
    }

    sql += ` ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, actualOffset);

    const result = await query(sql, params);

    const customers = result.rows.map((row) => ({
      id: row.customer_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      orders_count: row.orders_count || 0,
      total_spent: row.total_spent?.toString() || '0.00',
      tags: row.tags || [],
      addresses: row.addresses || [],
      store: row.store_name,
      store_type: row.store_type,
    }));

    return NextResponse.json({
      customers,
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
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

