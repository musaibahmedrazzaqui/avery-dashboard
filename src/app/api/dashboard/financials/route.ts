import { NextRequest, NextResponse } from 'next/server';
import { query, isDatabaseAvailable } from '@/lib/db';

/**
 * GET /api/dashboard/financials - Get financial data from database (OPTIMIZED)
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const storeName = searchParams.get('store_name') || searchParams.get('store');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    // Build base WHERE clause
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (storeName && storeName !== 'All') {
      whereClause += ` AND store_name = $${paramIndex}`;
      params.push(storeName);
      paramIndex++;
    }

    if (dateFrom) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    // Calculate date ranges for margins (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // OPTIMIZATION 1: Get outstanding invoices using SQL aggregation (much faster)
    const outstandingInvoicesSql = `
      SELECT 
        COALESCE(buyer_email, buyer_username, 'guest-' || order_id::text) as customer_key,
        COALESCE(buyer_username, buyer_email, 'Guest') as customer,
        COALESCE(buyer_email, 'N/A') as email,
        store_name as platform,
        SUM(total_price::numeric) as outstanding_amount,
        COUNT(*) as invoice_count,
        MAX(created_at) as last_order_date,
        MAX(financial_status) as status
      FROM dashboard.orders
      ${whereClause}
        AND (financial_status IN ('pending', 'partially_paid') OR financial_status IS NULL)
      GROUP BY customer_key, customer, email, platform
      ORDER BY outstanding_amount DESC
      LIMIT 10
    `;
    const outstandingInvoicesResult = await query(outstandingInvoicesSql, params);
    const outstandingInvoices = outstandingInvoicesResult.rows.map((row: any) => ({
      customer: row.customer || 'Guest',
      email: row.email || 'N/A',
      platform: row.platform,
      outstandingAmount: parseFloat(row.outstanding_amount || '0'),
      invoiceCount: parseInt(row.invoice_count || '0'),
      lastOrderDate: row.last_order_date,
      status: row.status || 'pending',
    }));

    // OPTIMIZATION 2: Calculate margins using SQL aggregation (only last 30 days)
    const marginsWhereClause = whereClause + ` AND created_at >= $${paramIndex}`;
    const marginsParams = [...params, thirtyDaysAgoStr];
    
    const marginsSql = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_price::numeric) as total_revenue
      FROM dashboard.orders
      ${marginsWhereClause}
    `;
    const marginsResult = await query(marginsSql, marginsParams);
    const marginsRow = marginsResult.rows[0] || {};
    const totalRevenue = parseFloat(marginsRow.total_revenue || '0');
    const estimatedCOGS = totalRevenue * 0.6;
    const grossMarginDollars = totalRevenue - estimatedCOGS;
    const grossMarginPercent = totalRevenue > 0 ? (grossMarginDollars / totalRevenue) * 100 : 0;

    // OPTIMIZATION 3: Calculate daily margins using SQL aggregation (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const dailyMarginsWhereClause = whereClause + ` AND created_at >= $${paramIndex}`;
    const dailyMarginsParams = [...params, sevenDaysAgoStr];

    const dailyMarginsSql = `
      SELECT 
        DATE(created_at) as date,
        SUM(total_price::numeric) as revenue,
        COUNT(*) as orders_count
      FROM dashboard.orders
      ${dailyMarginsWhereClause}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    const dailyMarginsResult = await query(dailyMarginsSql, dailyMarginsParams);
    
    // Create a map for quick lookup
    const dailyMarginsMap = new Map<string, { revenue: number; orders: number }>();
    dailyMarginsResult.rows.forEach((row: any) => {
      const dateStr = row.date.toISOString().split('T')[0];
      dailyMarginsMap.set(dateStr, {
        revenue: parseFloat(row.revenue || '0'),
        orders: parseInt(row.orders_count || '0'),
      });
    });

    // Fill in missing days (last 7 days)
    const dailyMargins = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayData = dailyMarginsMap.get(dateStr) || { revenue: 0, orders: 0 };
      const dayCOGS = dayData.revenue * 0.6;
      const dayMargin = dayData.revenue - dayCOGS;
      
      dailyMargins.push({
        date: dateStr,
        revenue: dayData.revenue,
        margin: dayMargin,
        marginPercent: dayData.revenue > 0 ? (dayMargin / dayData.revenue) * 100 : 0,
      });
    }

    // OPTIMIZATION 4: Calculate inventory using SQL aggregation
    // Build separate WHERE clause for products (no date filters, only store filter)
    let inventoryWhereClause = 'WHERE 1=1';
    const inventoryParams: any[] = [];
    let inventoryParamIndex = 1;

    if (storeName && storeName !== 'All') {
      inventoryWhereClause += ` AND store_name = $${inventoryParamIndex}`;
      inventoryParams.push(storeName);
      inventoryParamIndex++;
    }

    const inventorySql = `
      SELECT 
        store_name as platform,
        variants
      FROM dashboard.products
      ${inventoryWhereClause}
    `;
    const inventoryResult = await query(inventorySql, inventoryParams);
    const products = inventoryResult.rows;

    // Calculate inventory value (this still needs to be done in JS due to JSON structure)
    const platformValuesMap = new Map<string, { value: number; items: number }>();
    let totalInventoryValue = 0;

    products.forEach((product: any) => {
      const platform = product.platform || 'Unknown';
      if (!platformValuesMap.has(platform)) {
        platformValuesMap.set(platform, { value: 0, items: 0 });
      }
      
      const platformData = platformValuesMap.get(platform)!;
      const variants = product.variants || [];
      
      variants.forEach((variant: any) => {
        const quantity = variant.inventory_quantity || 0;
        const price = parseFloat(variant.price || '0');
        const value = quantity * price;
        
        platformData.value += value;
        platformData.items += quantity;
        totalInventoryValue += value;
      });
    });

    const platformValues = Array.from(platformValuesMap.entries()).map(([platform, data]) => ({
      platform,
      value: data.value,
      items: data.items,
    }));

    return NextResponse.json({
      outstandingInvoices,
      margins: {
        totalRevenue,
        estimatedCOGS,
        grossMarginDollars,
        grossMarginPercent,
      },
      dailyMargins,
      inventory: {
        totalInventoryValue,
        platformValues,
      },
    });
  } catch (error: any) {
    console.error('Error fetching financial data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
