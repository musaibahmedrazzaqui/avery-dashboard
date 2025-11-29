import { NextRequest, NextResponse } from 'next/server';
import { query, isDatabaseAvailable } from '@/lib/db';

/**
 * GET /api/dashboard/stats - Get dashboard statistics from database
 */
export async function GET(req: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      {
        error: 'Database not configured',
        totalRevenue: '0.00',
        activeOrders: 0,
        totalCustomers: 0,
        revenueData: [],
        fulfillmentStatus: [],
        financialStatus: [],
        topProducts: [],
      },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const storeType = searchParams.get('store_type');
    const storeName = searchParams.get('store_name');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (storeType) {
      whereClause += ` AND store_type = $${paramIndex}`;
      params.push(storeType);
      paramIndex++;
    }

    if (storeName) {
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

    // Total revenue
    const revenueResult = await query(
      `SELECT COALESCE(SUM(total_price), 0) as total FROM dashboard.orders ${whereClause}`,
      params
    );
    const totalRevenue = parseFloat(revenueResult.rows[0].total) || 0;

    // Active orders (not fulfilled)
    const activeOrdersResult = await query(
      `SELECT COUNT(*) as count FROM dashboard.orders ${whereClause} AND (fulfillment_status IS NULL OR fulfillment_status != 'fulfilled')`,
      params
    );
    const activeOrders = parseInt(activeOrdersResult.rows[0].count) || 0;

    // Total customers
    const customersResult = await query(
      `SELECT COUNT(DISTINCT buyer_email) as count FROM dashboard.orders ${whereClause} AND buyer_email IS NOT NULL`,
      params
    );
    const totalCustomers = parseInt(customersResult.rows[0].count) || 0;

    // Total orders
    const ordersResult = await query(
      `SELECT COUNT(*) as count FROM dashboard.orders ${whereClause}`,
      params
    );
    const totalOrders = parseInt(ordersResult.rows[0].count) || 0;

    // Revenue by day (last 7 days)
    const revenueDataResult = await query(
      `SELECT 
        created_date as date,
        COALESCE(SUM(total_price), 0) as revenue
      FROM dashboard.orders
      ${whereClause}
      AND created_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY created_date
      ORDER BY created_date ASC`,
      params
    );
    const revenueData = revenueDataResult.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      revenue: parseFloat(row.revenue) || 0,
    }));

    // Fulfillment status breakdown
    const fulfillmentResult = await query(
      `SELECT 
        COALESCE(fulfillment_status, 'pending') as status,
        COUNT(*) as count
      FROM dashboard.orders
      ${whereClause}
      GROUP BY fulfillment_status`,
      params
    );
    const fulfillmentStatus = fulfillmentResult.rows.map((row) => ({
      name: row.status,
      value: parseInt(row.count) || 0,
    }));

    // Financial status breakdown
    const financialResult = await query(
      `SELECT 
        COALESCE(financial_status, 'pending') as status,
        COUNT(*) as count
      FROM dashboard.orders
      ${whereClause}
      GROUP BY financial_status`,
      params
    );
    const financialStatus = financialResult.rows.map((row) => ({
      name: row.status,
      value: parseInt(row.count) || 0,
    }));

    // Top products (from line items) - using subquery to fix aggregate function issue
    const topProductsResult = await query(
      `WITH expanded_items AS (
        SELECT 
          jsonb_array_elements(line_items) as item
        FROM dashboard.orders
        ${whereClause}
      )
      SELECT 
        item->>'title' as product_title,
        SUM((item->>'quantity')::int) as units,
        SUM((item->>'price')::numeric * (item->>'quantity')::int) as revenue
      FROM expanded_items
      GROUP BY product_title
      ORDER BY revenue DESC
      LIMIT 10`,
      params
    );
    const topProducts = topProductsResult.rows.map((row) => ({
      units: parseInt(row.units) || 0,
      revenue: parseFloat(row.revenue) || 0,
      store: storeName || 'all',
    }));

    // Analytics: Revenue by month (last 12 months)
    const revenueByMonthResult = await query(
      `SELECT 
        DATE_TRUNC('month', created_date) as month,
        COALESCE(SUM(total_price), 0) as revenue,
        COUNT(*) as orders
      FROM dashboard.orders
      ${whereClause}
      AND created_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC`,
      params
    );
    const revenueByMonth = revenueByMonthResult.rows.map((row) => ({
      month: row.month.toISOString().split('T')[0].substring(0, 7), // YYYY-MM
      revenue: parseFloat(row.revenue) || 0,
      orders: parseInt(row.orders) || 0,
    }));

    // Analytics: Revenue by store type
    const revenueByStoreResult = await query(
      `SELECT 
        store_type,
        COALESCE(SUM(total_price), 0) as revenue,
        COUNT(*) as orders
      FROM dashboard.orders
      ${whereClause}
      GROUP BY store_type`,
      params
    );
    const revenueByStore = revenueByStoreResult.rows.map((row) => ({
      store_type: row.store_type,
      revenue: parseFloat(row.revenue) || 0,
      orders: parseInt(row.orders) || 0,
    }));

    // Finance: Average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Finance: Revenue growth (compare last 30 days vs previous 30 days)
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);
    const prev30Days = new Date(last30Days);
    prev30Days.setDate(prev30Days.getDate() - 30);

    const recentRevenueResult = await query(
      `SELECT COALESCE(SUM(total_price), 0) as revenue
      FROM dashboard.orders
      ${whereClause}
      AND created_date >= $${paramIndex}
      AND created_date < $${paramIndex + 1}`,
      [...params, last30Days.toISOString().split('T')[0], now.toISOString().split('T')[0]]
    );
    const recentRevenue = parseFloat(recentRevenueResult.rows[0].revenue) || 0;

    const previousRevenueResult = await query(
      `SELECT COALESCE(SUM(total_price), 0) as revenue
      FROM dashboard.orders
      ${whereClause}
      AND created_date >= $${paramIndex}
      AND created_date < $${paramIndex + 1}`,
      [...params, prev30Days.toISOString().split('T')[0], last30Days.toISOString().split('T')[0]]
    );
    const previousRevenue = parseFloat(previousRevenueResult.rows[0].revenue) || 0;
    const revenueGrowth = previousRevenue > 0 
      ? ((recentRevenue - previousRevenue) / previousRevenue * 100) 
      : (recentRevenue > 0 ? 100 : 0);

    // Profit: Calculate profit margin (assuming cost is 50% of revenue for now - can be enhanced with actual cost data)
    // This is a placeholder - in production, you'd calculate from actual product costs
    const estimatedCost = totalRevenue * 0.5; // 50% cost assumption
    const estimatedProfit = totalRevenue - estimatedCost;
    const profitMargin = totalRevenue > 0 ? (estimatedProfit / totalRevenue * 100) : 0;

    // Analytics: Top customers by revenue
    const topCustomersResult = await query(
      `SELECT 
        buyer_email,
        buyer_username,
        COUNT(*) as orders_count,
        COALESCE(SUM(total_price), 0) as total_spent
      FROM dashboard.orders
      ${whereClause}
      AND (buyer_email IS NOT NULL OR buyer_username IS NOT NULL)
      GROUP BY buyer_email, buyer_username
      ORDER BY total_spent DESC
      LIMIT 10`,
      params
    );
    const topCustomers = topCustomersResult.rows.map((row) => ({
      email: row.buyer_email || '',
      username: row.buyer_username || '',
      orders_count: parseInt(row.orders_count) || 0,
      total_spent: parseFloat(row.total_spent) || 0,
    }));

    // Analytics: Orders by day of week
    const ordersByDayResult = await query(
      `SELECT 
        EXTRACT(DOW FROM created_at) as day_of_week,
        COUNT(*) as orders,
        COALESCE(SUM(total_price), 0) as revenue
      FROM dashboard.orders
      ${whereClause}
      AND created_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day_of_week
      ORDER BY day_of_week`,
      params
    );
    const ordersByDay = ordersByDayResult.rows.map((row) => ({
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(row.day_of_week)],
      orders: parseInt(row.orders) || 0,
      revenue: parseFloat(row.revenue) || 0,
    }));

    return NextResponse.json({
      totalRevenue: totalRevenue.toFixed(2),
      activeOrders,
      totalCustomers,
      totalOrders,
      revenueData,
      fulfillmentStatus,
      financialStatus,
      topProducts,
      // Analytics
      revenueByMonth,
      revenueByStore,
      ordersByDay,
      topCustomers,
      // Finance
      avgOrderValue: avgOrderValue.toFixed(2),
      revenueGrowth: revenueGrowth.toFixed(2),
      recentRevenue: recentRevenue.toFixed(2),
      previousRevenue: previousRevenue.toFixed(2),
      // Profit
      estimatedProfit: estimatedProfit.toFixed(2),
      estimatedCost: estimatedCost.toFixed(2),
      profitMargin: profitMargin.toFixed(2),
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

