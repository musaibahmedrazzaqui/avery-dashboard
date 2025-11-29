import { NextRequest, NextResponse } from 'next/server';
import { query, isDatabaseAvailable } from '@/lib/db';

/**
 * GET /api/dashboard/reports - Get aggregated reports from database
 * All aggregations are done server-side for performance
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
    const reportType = searchParams.get('type') || 'sales'; // sales, products, customers, inventory, financial
    const storeType = searchParams.get('store_type');
    const storeName = searchParams.get('store_name');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const period = searchParams.get('period') || 'month'; // day, week, month, year

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

    switch (reportType) {
      case 'sales': {
        // Sales Report: Revenue by period, store, product
        let dateTrunc = 'DATE_TRUNC(\'month\', created_date)';
        if (period === 'day') {
          dateTrunc = 'created_date';
        } else if (period === 'week') {
          dateTrunc = 'DATE_TRUNC(\'week\', created_date)';
        } else if (period === 'year') {
          dateTrunc = 'DATE_TRUNC(\'year\', created_date)';
        }

        // Revenue by period
        const revenueByPeriodResult = await query(
          `SELECT 
            ${dateTrunc} as period,
            COALESCE(SUM(total_price), 0) as revenue,
            COUNT(*) as orders,
            COUNT(DISTINCT buyer_email) as customers
          FROM dashboard.orders
          ${whereClause}
          GROUP BY period
          ORDER BY period ASC`,
          params
        );

        // Revenue by store
        const revenueByStoreResult = await query(
          `SELECT 
            store_type,
            store_name,
            COALESCE(SUM(total_price), 0) as revenue,
            COUNT(*) as orders,
            AVG(total_price) as avg_order_value
          FROM dashboard.orders
          ${whereClause}
          GROUP BY store_type, store_name
          ORDER BY revenue DESC`,
          params
        );

        // Top selling products
        const topProductsResult = await query(
          `WITH expanded_items AS (
            SELECT 
              jsonb_array_elements(line_items) as item,
              store_type,
              store_name,
              created_at
            FROM dashboard.orders
            ${whereClause}
          )
          SELECT 
            item->>'title' as product_title,
            item->>'sku' as sku,
            store_type,
            store_name,
            SUM((item->>'quantity')::int) as units_sold,
            SUM((item->>'price')::numeric * (item->>'quantity')::int) as revenue
          FROM expanded_items
          GROUP BY product_title, sku, store_type, store_name
          ORDER BY revenue DESC
          LIMIT 50`,
          params
        );

        return NextResponse.json({
          type: 'sales',
          revenueByPeriod: revenueByPeriodResult.rows.map((row) => ({
            period: row.period.toISOString().split('T')[0],
            revenue: parseFloat(row.revenue) || 0,
            orders: parseInt(row.orders) || 0,
            customers: parseInt(row.customers) || 0,
          })),
          revenueByStore: revenueByStoreResult.rows.map((row) => ({
            store_type: row.store_type,
            store_name: row.store_name,
            revenue: parseFloat(row.revenue) || 0,
            orders: parseInt(row.orders) || 0,
            avg_order_value: parseFloat(row.avg_order_value) || 0,
          })),
          topProducts: topProductsResult.rows.map((row) => ({
            product_title: row.product_title,
            sku: row.sku,
            store_type: row.store_type,
            store_name: row.store_name,
            units_sold: parseInt(row.units_sold) || 0,
            revenue: parseFloat(row.revenue) || 0,
          })),
        });
      }

      case 'products': {
        // Product Performance Report
        // Top products by revenue
        const topProductsByRevenueResult = await query(
          `WITH expanded_items AS (
            SELECT 
              jsonb_array_elements(line_items) as item,
              created_at
            FROM dashboard.orders
            ${whereClause}
          )
          SELECT 
            item->>'title' as product_title,
            item->>'sku' as sku,
            SUM((item->>'quantity')::int) as units_sold,
            SUM((item->>'price')::numeric * (item->>'quantity')::int) as revenue,
            AVG((item->>'price')::numeric) as avg_price,
            COUNT(DISTINCT DATE_TRUNC('day', created_at)) as days_sold
          FROM expanded_items
          GROUP BY product_title, sku
          ORDER BY revenue DESC
          LIMIT 100`,
          params
        );

        // Products by store
        const productsByStoreResult = await query(
          `SELECT 
            store_type,
            store_name,
            COUNT(*) as total_products,
            COUNT(DISTINCT product_type) as product_types,
            COUNT(DISTINCT vendor) as vendors
          FROM dashboard.products
          WHERE 1=1
          ${storeType ? ` AND store_type = $${paramIndex}` : ''}
          ${storeName ? ` AND store_name = $${storeType ? paramIndex + 1 : paramIndex}` : ''}
          GROUP BY store_type, store_name`,
          storeType && storeName ? [storeType, storeName] : storeType ? [storeType] : storeName ? [storeName] : []
        );

        // Low inventory products - use lateral join to avoid set-returning function in WHERE
        const lowInventoryResult = await query(
          `SELECT 
            p.product_id,
            p.title,
            p.store_type,
            p.store_name,
            v.variant
          FROM dashboard.products p
          CROSS JOIN LATERAL jsonb_array_elements(p.variants) v(variant)
          WHERE 1=1
          ${storeType ? ` AND p.store_type = $${paramIndex}` : ''}
          ${storeName ? ` AND p.store_name = $${storeType ? paramIndex + 1 : paramIndex}` : ''}
          AND v.variant->>'inventory_quantity' IS NOT NULL
          AND (v.variant->>'inventory_quantity')::int < 10`,
          storeType && storeName ? [storeType, storeName] : storeType ? [storeType] : storeName ? [storeName] : []
        );

        // Aggregate low inventory
        const lowInventoryMap = new Map();
        lowInventoryResult.rows.forEach((row) => {
          const key = `${row.product_id}_${row.store_type}_${row.store_name}`;
          if (!lowInventoryMap.has(key)) {
            lowInventoryMap.set(key, {
              product_id: row.product_id,
              title: row.title,
              store_type: row.store_type,
              store_name: row.store_name,
              low_stock_variants: 0,
            });
          }
          lowInventoryMap.get(key).low_stock_variants++;
        });

        return NextResponse.json({
          type: 'products',
          topProductsByRevenue: topProductsByRevenueResult.rows.map((row) => ({
            product_title: row.product_title,
            sku: row.sku,
            units_sold: parseInt(row.units_sold) || 0,
            revenue: parseFloat(row.revenue) || 0,
            avg_price: parseFloat(row.avg_price) || 0,
            days_sold: parseInt(row.days_sold) || 0,
          })),
          productsByStore: productsByStoreResult.rows.map((row) => ({
            store_type: row.store_type,
            store_name: row.store_name,
            total_products: parseInt(row.total_products) || 0,
            product_types: parseInt(row.product_types) || 0,
            vendors: parseInt(row.vendors) || 0,
          })),
          lowInventory: Array.from(lowInventoryMap.values()),
        });
      }

      case 'customers': {
        // Customer Report
        // Top customers by revenue
        const topCustomersResult = await query(
          `SELECT 
            buyer_email,
            buyer_username,
            COUNT(*) as orders_count,
            COALESCE(SUM(total_price), 0) as total_spent,
            AVG(total_price) as avg_order_value,
            MIN(created_at) as first_order_date,
            MAX(created_at) as last_order_date
          FROM dashboard.orders
          ${whereClause}
          AND (buyer_email IS NOT NULL OR buyer_username IS NOT NULL)
          GROUP BY buyer_email, buyer_username
          ORDER BY total_spent DESC
          LIMIT 100`,
          params
        );

        // Customer acquisition by period
        let dateTrunc = 'DATE_TRUNC(\'month\', created_date)';
        if (period === 'day') {
          dateTrunc = 'created_date';
        } else if (period === 'week') {
          dateTrunc = 'DATE_TRUNC(\'week\', created_date)';
        } else if (period === 'year') {
          dateTrunc = 'DATE_TRUNC(\'year\', created_date)';
        }

        const customerAcquisitionResult = await query(
          `SELECT 
            ${dateTrunc} as period,
            COUNT(DISTINCT buyer_email) as new_customers
          FROM dashboard.orders
          ${whereClause}
          AND buyer_email IS NOT NULL
          GROUP BY period
          ORDER BY period ASC`,
          params
        );

        // Customer lifetime value distribution
        const customerLTVResult = await query(
          `SELECT 
            CASE
              WHEN total_spent < 50 THEN '0-50'
              WHEN total_spent < 100 THEN '50-100'
              WHEN total_spent < 250 THEN '100-250'
              WHEN total_spent < 500 THEN '250-500'
              ELSE '500+'
            END as ltv_range,
            COUNT(*) as customer_count
          FROM (
            SELECT 
              buyer_email,
              COALESCE(SUM(total_price), 0) as total_spent
            FROM dashboard.orders
            ${whereClause}
            AND buyer_email IS NOT NULL
            GROUP BY buyer_email
          ) as customer_totals
          GROUP BY ltv_range
          ORDER BY ltv_range`,
          params
        );

        return NextResponse.json({
          type: 'customers',
          topCustomers: topCustomersResult.rows.map((row) => ({
            email: row.buyer_email || '',
            username: row.buyer_username || '',
            orders_count: parseInt(row.orders_count) || 0,
            total_spent: parseFloat(row.total_spent) || 0,
            avg_order_value: parseFloat(row.avg_order_value) || 0,
            first_order_date: row.first_order_date?.toISOString() || '',
            last_order_date: row.last_order_date?.toISOString() || '',
          })),
          customerAcquisition: customerAcquisitionResult.rows.map((row) => ({
            period: row.period.toISOString().split('T')[0],
            new_customers: parseInt(row.new_customers) || 0,
          })),
          customerLTV: customerLTVResult.rows.map((row) => ({
            ltv_range: row.ltv_range,
            customer_count: parseInt(row.customer_count) || 0,
          })),
        });
      }

      case 'inventory': {
        // Inventory Report
        // Inventory summary by store - use CTE to calculate inventory per product
        const inventorySummaryResult = await query(
          `WITH product_inventory AS (
            SELECT 
              p.store_type,
              p.store_name,
              p.product_id,
              COALESCE(SUM((v.variant->>'inventory_quantity')::int), 0) as product_inventory
            FROM dashboard.products p
            CROSS JOIN LATERAL jsonb_array_elements(p.variants) v(variant)
            WHERE 1=1
            ${storeType ? ` AND p.store_type = $${paramIndex}` : ''}
            ${storeName ? ` AND p.store_name = $${storeType ? paramIndex + 1 : paramIndex}` : ''}
            AND v.variant->>'inventory_quantity' IS NOT NULL
            GROUP BY p.store_type, p.store_name, p.product_id
          )
          SELECT 
            store_type,
            store_name,
            COUNT(*) as total_products,
            SUM(product_inventory) as total_inventory,
            COUNT(CASE WHEN product_inventory < 10 THEN 1 END) as low_stock_count
          FROM product_inventory
          GROUP BY store_type, store_name`,
          storeType && storeName ? [storeType, storeName] : storeType ? [storeType] : storeName ? [storeName] : []
        );

        // Products by inventory level - use CTE and order by level name
        const inventoryLevelsResult = await query(
          `WITH inventory_totals AS (
            SELECT 
              p.product_id,
              COALESCE(SUM((v.variant->>'inventory_quantity')::int), 0) as total_inventory
            FROM dashboard.products p
            CROSS JOIN LATERAL jsonb_array_elements(p.variants) v(variant)
            WHERE 1=1
            ${storeType ? ` AND p.store_type = $${paramIndex}` : ''}
            ${storeName ? ` AND p.store_name = $${storeType ? paramIndex + 1 : paramIndex}` : ''}
            AND v.variant->>'inventory_quantity' IS NOT NULL
            GROUP BY p.product_id
          ),
          inventory_levels AS (
            SELECT 
              CASE
                WHEN total_inventory = 0 THEN 'Out of Stock'
                WHEN total_inventory < 10 THEN 'Low Stock'
                WHEN total_inventory < 50 THEN 'Medium Stock'
                ELSE 'High Stock'
              END as inventory_level
            FROM inventory_totals
          )
          SELECT 
            inventory_level,
            COUNT(*) as product_count
          FROM inventory_levels
          GROUP BY inventory_level
          ORDER BY 
            CASE inventory_level
              WHEN 'Out of Stock' THEN 1
              WHEN 'Low Stock' THEN 2
              WHEN 'Medium Stock' THEN 3
              WHEN 'High Stock' THEN 4
            END`,
          storeType && storeName ? [storeType, storeName] : storeType ? [storeType] : storeName ? [storeName] : []
        );

        return NextResponse.json({
          type: 'inventory',
          inventorySummary: inventorySummaryResult.rows.map((row) => ({
            store_type: row.store_type,
            store_name: row.store_name,
            total_products: parseInt(row.total_products) || 0,
            total_inventory: parseInt(row.total_inventory) || 0,
            low_stock_count: parseInt(row.low_stock_count) || 0,
          })),
          inventoryLevels: inventoryLevelsResult.rows.map((row) => ({
            inventory_level: row.inventory_level,
            product_count: parseInt(row.product_count) || 0,
          })),
        });
      }

      case 'financial': {
        // Financial Report
        // Revenue summary
        const revenueSummaryResult = await query(
          `SELECT 
            COALESCE(SUM(total_price), 0) as total_revenue,
            COUNT(*) as total_orders,
            AVG(total_price) as avg_order_value,
            MIN(total_price) as min_order,
            MAX(total_price) as max_order
          FROM dashboard.orders
          ${whereClause}`,
          params
        );

        // Revenue by payment status
        const revenueByFinancialStatusResult = await query(
          `SELECT 
            COALESCE(financial_status, 'pending') as status,
            COUNT(*) as orders,
            COALESCE(SUM(total_price), 0) as revenue
          FROM dashboard.orders
          ${whereClause}
          GROUP BY financial_status`,
          params
        );

        // Revenue by fulfillment status
        const revenueByFulfillmentResult = await query(
          `SELECT 
            COALESCE(fulfillment_status, 'pending') as status,
            COUNT(*) as orders,
            COALESCE(SUM(total_price), 0) as revenue
          FROM dashboard.orders
          ${whereClause}
          GROUP BY fulfillment_status`,
          params
        );

        // Revenue trend (last 12 months)
        const revenueTrendResult = await query(
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

        return NextResponse.json({
          type: 'financial',
          revenueSummary: revenueSummaryResult.rows[0] ? {
            total_revenue: parseFloat(revenueSummaryResult.rows[0].total_revenue) || 0,
            total_orders: parseInt(revenueSummaryResult.rows[0].total_orders) || 0,
            avg_order_value: parseFloat(revenueSummaryResult.rows[0].avg_order_value) || 0,
            min_order: parseFloat(revenueSummaryResult.rows[0].min_order) || 0,
            max_order: parseFloat(revenueSummaryResult.rows[0].max_order) || 0,
          } : null,
          revenueByFinancialStatus: revenueByFinancialStatusResult.rows.map((row) => ({
            status: row.status,
            orders: parseInt(row.orders) || 0,
            revenue: parseFloat(row.revenue) || 0,
          })),
          revenueByFulfillment: revenueByFulfillmentResult.rows.map((row) => ({
            status: row.status,
            orders: parseInt(row.orders) || 0,
            revenue: parseFloat(row.revenue) || 0,
          })),
          revenueTrend: revenueTrendResult.rows.map((row) => ({
            month: row.month.toISOString().split('T')[0].substring(0, 7),
            revenue: parseFloat(row.revenue) || 0,
            orders: parseInt(row.orders) || 0,
          })),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown report type: ${reportType}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}