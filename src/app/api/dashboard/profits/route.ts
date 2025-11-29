import { NextRequest, NextResponse } from 'next/server';
import { query, isDatabaseAvailable } from '@/lib/db';

/**
 * GET /api/dashboard/profits - Get profit data with server-side aggregation
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured', profits: [], summary: null },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const storeType = searchParams.get('store_type');
    const storeName = searchParams.get('store_name');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (storeType) {
      whereClause += ` AND o.store_type = $${paramIndex}`;
      params.push(storeType);
      paramIndex++;
    }

    if (storeName) {
      whereClause += ` AND o.store_name = $${paramIndex}`;
      params.push(storeName);
      paramIndex++;
    }

    if (dateFrom) {
      whereClause += ` AND o.created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereClause += ` AND o.created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    // Fallback COGS rates by category (used when cost is not available from API)
    // Shopify products: Cost comes from InventoryItem API
    // eBay products: Cost is null (eBay doesn't provide cost via API), so we use fallback
    const cogsByCategory: Record<string, number> = {
      'Eyeglasses': 0.50,
      'Sunglasses': 0.55,
      'Contact Lenses': 0.60,
      'Accessories': 0.65,
      'Uncategorized': 0.60,
    };

    // Get profit breakdown by order with aggregated line items
    const profitsQuery = `
      WITH expanded_items AS (
        SELECT 
          o.order_id,
          o.order_number,
          o.store_type,
          o.store_name,
          o.total_price as order_total,
          o.created_at,
          o.created_date,
          jsonb_array_elements(o.line_items) as item
        FROM dashboard.orders o
        ${whereClause}
      ),
      item_profits AS (
        SELECT 
          ei.order_id,
          ei.order_number,
          ei.store_type,
          ei.store_name,
          ei.order_total,
          ei.created_at,
          ei.created_date,
          ei.item->>'title' as item_title,
          ei.item->>'sku' as item_sku,
          (ei.item->>'quantity')::int as quantity,
          (ei.item->>'price')::numeric as item_price,
          -- Use actual cost from database (fetched from Shopify InventoryItem API)
          -- Fallback to category-based estimate if cost is null (eBay or products without cost data)
          COALESCE(
            p.cost,
            (ei.item->>'price')::numeric * (
              CASE 
                WHEN p.product_type = 'Eyeglasses' THEN 0.50
                WHEN p.product_type = 'Sunglasses' THEN 0.55
                WHEN p.product_type = 'Contact Lenses' THEN 0.60
                WHEN p.product_type = 'Accessories' THEN 0.65
                ELSE 0.60
              END
            )
          ) as item_cost
        FROM expanded_items ei
        LEFT JOIN dashboard.products p ON (
          p.store_type = ei.store_type 
          AND p.store_name = ei.store_name
          AND (
            p.product_id = ei.item->>'itemId'
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(p.variants) v
              WHERE v->>'sku' = ei.item->>'sku'
            )
          )
        )
      )
      SELECT 
        order_id,
        order_number,
        store_type,
        store_name,
        order_total,
        created_at,
        created_date,
        SUM(item_price * quantity) as revenue,
        SUM(item_cost * quantity) as cost,
        SUM((item_price - item_cost) * quantity) as profit,
        COUNT(*) as items_count
      FROM item_profits
      GROUP BY order_id, order_number, store_type, store_name, order_total, created_at, created_date
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const profitsResult = await query(profitsQuery, [...params, limit, offset]);

    // Get total count for pagination
    let countSql = `SELECT COUNT(DISTINCT order_id) as total FROM dashboard.orders ${whereClause}`;
    const countResult = await query(countSql, params);
    const totalCount = parseInt(countResult.rows[0].total) || 0;

    const profits = profitsResult.rows.map((row) => ({
      order_id: row.order_id,
      order_number: row.order_number,
      store: row.store_name,
      store_type: row.store_type,
      revenue: parseFloat(row.revenue) || 0,
      cost: parseFloat(row.cost) || 0,
      profit: parseFloat(row.profit) || 0,
      margin: parseFloat(row.revenue) > 0 
        ? ((parseFloat(row.profit) / parseFloat(row.revenue)) * 100) 
        : 0,
      items_count: parseInt(row.items_count) || 0,
      created_at: row.created_at.toISOString(),
      created_date: row.created_date.toISOString().split('T')[0],
    }));

    // Get summary statistics
    const summaryQuery = `
      WITH expanded_items AS (
        SELECT 
          o.order_id,
          jsonb_array_elements(o.line_items) as item
        FROM dashboard.orders o
        ${whereClause}
      ),
      item_profits AS (
        SELECT 
          (ei.item->>'quantity')::int as quantity,
          (ei.item->>'price')::numeric as item_price,
          COALESCE(
            p.cost,
            (ei.item->>'price')::numeric * 0.60
          ) as item_cost
        FROM expanded_items ei
        LEFT JOIN dashboard.products p ON (
          p.store_type = o.store_type 
          AND p.store_name = o.store_name
          AND (
            p.product_id = ei.item->>'itemId'
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(p.variants) v
              WHERE v->>'sku' = ei.item->>'sku'
            )
          )
        )
      )
      SELECT 
        COALESCE(SUM(item_price * quantity), 0) as total_revenue,
        COALESCE(SUM(item_cost * quantity), 0) as total_cost,
        COALESCE(SUM((item_price - item_cost) * quantity), 0) as total_profit,
        COUNT(*) as total_items
      FROM item_profits
    `;

    // Fix the summary query - need to join with orders table
    const summaryQueryFixed = `
      WITH expanded_items AS (
        SELECT 
          o.order_id,
          o.store_type,
          o.store_name,
          jsonb_array_elements(o.line_items) as item
        FROM dashboard.orders o
        ${whereClause}
      ),
      item_profits AS (
        SELECT 
          ei.store_type,
          ei.store_name,
          (ei.item->>'quantity')::int as quantity,
          (ei.item->>'price')::numeric as item_price,
          -- Use actual cost from database (fetched from Shopify InventoryItem API)
          -- Fallback to 60% estimate if cost is null (eBay or products without cost data)
          COALESCE(
            p.cost,
            (ei.item->>'price')::numeric * 0.60
          ) as item_cost
        FROM expanded_items ei
        LEFT JOIN dashboard.products p ON (
          p.store_type = ei.store_type 
          AND p.store_name = ei.store_name
          AND (
            p.product_id = ei.item->>'itemId'
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(p.variants) v
              WHERE v->>'sku' = ei.item->>'sku'
            )
          )
        )
      )
      SELECT 
        COALESCE(SUM(item_price * quantity), 0) as total_revenue,
        COALESCE(SUM(item_cost * quantity), 0) as total_cost,
        COALESCE(SUM((item_price - item_cost) * quantity), 0) as total_profit,
        COUNT(*) as total_items
      FROM item_profits
    `;

    const summaryResult = await query(summaryQueryFixed, params);
    const summary = summaryResult.rows[0] ? {
      total_revenue: parseFloat(summaryResult.rows[0].total_revenue) || 0,
      total_cost: parseFloat(summaryResult.rows[0].total_cost) || 0,
      total_profit: parseFloat(summaryResult.rows[0].total_profit) || 0,
      total_items: parseInt(summaryResult.rows[0].total_items) || 0,
      average_margin: parseFloat(summaryResult.rows[0].total_revenue) > 0
        ? ((parseFloat(summaryResult.rows[0].total_profit || 0) / parseFloat(summaryResult.rows[0].total_revenue)) * 100)
        : 0,
    } : null;

    // Get profit by date (last 30 days)
    const profitByDateQuery = `
      WITH expanded_items AS (
        SELECT 
          o.created_date,
          jsonb_array_elements(o.line_items) as item
        FROM dashboard.orders o
        ${whereClause}
        AND o.created_date >= CURRENT_DATE - INTERVAL '30 days'
      ),
      item_profits AS (
        SELECT 
          ei.created_date,
          (ei.item->>'quantity')::int as quantity,
          (ei.item->>'price')::numeric as item_price,
          -- Use actual cost from database (fetched from Shopify InventoryItem API)
          -- Fallback to 60% estimate if cost is null (eBay or products without cost data)
          COALESCE(
            p.cost,
            (ei.item->>'price')::numeric * 0.60
          ) as item_cost
        FROM expanded_items ei
        LEFT JOIN dashboard.products p ON (
          p.store_type = (SELECT store_type FROM dashboard.orders WHERE order_id = (SELECT order_id FROM expanded_items LIMIT 1))
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.variants) v
            WHERE v->>'sku' = ei.item->>'sku'
          )
        )
      )
      SELECT 
        created_date,
        COALESCE(SUM(item_price * quantity), 0) as revenue,
        COALESCE(SUM(item_cost * quantity), 0) as cost,
        COALESCE(SUM((item_price - item_cost) * quantity), 0) as profit
      FROM item_profits
      GROUP BY created_date
      ORDER BY created_date ASC
    `;

    // Simplified profit by date query
    const profitByDateQuerySimple = `
      SELECT 
        o.created_date,
        COALESCE(SUM(o.total_price), 0) as revenue,
        COALESCE(SUM(o.total_price * 0.60), 0) as cost,
        COALESCE(SUM(o.total_price * 0.40), 0) as profit
      FROM dashboard.orders o
      ${whereClause}
      AND o.created_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY o.created_date
      ORDER BY o.created_date ASC
    `;

    const profitByDateResult = await query(profitByDateQuerySimple, params);
    const profitByDate = profitByDateResult.rows.map((row) => ({
      date: row.created_date.toISOString().split('T')[0],
      revenue: parseFloat(row.revenue) || 0,
      cost: parseFloat(row.cost) || 0,
      profit: parseFloat(row.profit) || 0,
    }));

    return NextResponse.json({
      profits,
      summary,
      profitByDate,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching profits:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
