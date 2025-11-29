import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/dashboard/products - Get products from database
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
        product_id,
        store_type,
        store_name,
        title,
        description,
        product_type,
        vendor,
        tags,
        variants,
        synced_at
      FROM dashboard.products
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
        title ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex} OR
        vendor ILIKE $${paramIndex} OR
        product_type ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as total FROM dashboard.products WHERE 1=1`;
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
        title ILIKE $${countParamIndex} OR
        description ILIKE $${countParamIndex} OR
        vendor ILIKE $${countParamIndex} OR
        product_type ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    
    const countResult = await query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].total) || 0;

    // Handle sorting
    let orderBy = 'synced_at DESC';
    if (sort) {
      if (sort === 'title_asc') orderBy = 'title ASC';
      else if (sort === 'title_desc') orderBy = 'title DESC';
      else if (sort === 'inventory_desc') orderBy = 'synced_at DESC'; // Will sort client-side if needed
      else if (sort === 'inventory_asc') orderBy = 'synced_at ASC';
    }

    sql += ` ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, actualOffset);

    const result = await query(sql, params);

    const products = result.rows.map((row) => ({
      id: row.product_id,
      title: row.title,
      body_html: row.description,
      product_type: row.product_type,
      vendor: row.vendor,
      tags: row.tags || [],
      variants: row.variants || [],
      store: row.store_name,
      store_type: row.store_type,
    }));

    return NextResponse.json({
      products,
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
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

