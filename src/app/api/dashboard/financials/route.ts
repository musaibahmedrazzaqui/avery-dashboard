import { NextRequest, NextResponse } from 'next/server';
import { query, isDatabaseAvailable } from '@/lib/db';

/**
 * GET /api/dashboard/financials - Get financial data from database
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

    // Get orders for outstanding invoices and margins
    const ordersSql = `
      SELECT 
        order_id,
        store_name,
        store_type,
        order_number,
        total_price,
        created_at,
        financial_status,
        fulfillment_status,
        buyer_username,
        buyer_email,
        buyer_email as email
      FROM dashboard.orders
      ${whereClause}
      ORDER BY created_at DESC
    `;
    const ordersResult = await query(ordersSql, params);
    const orders = ordersResult.rows;

    // Calculate outstanding invoices
    const outstandingInvoicesMap = new Map<string, any>();
    
    orders
      .filter((order: any) => 
        order.financial_status === 'pending' || 
        order.financial_status === 'partially_paid' ||
        order.financial_status === null
      )
      .forEach((order: any) => {
        const customerKey = order.buyer_email || order.buyer_username
          ? `${order.buyer_email || order.buyer_username}-${order.store_name}` 
          : `guest-${order.order_id}`;
        
        if (!outstandingInvoicesMap.has(customerKey)) {
          const customerName = order.buyer_username 
            ? order.buyer_username.split(' ')[0] + ' ' + (order.buyer_username.split(' ').slice(1).join(' ') || '')
            : order.buyer_email || 'Guest';
          
          outstandingInvoicesMap.set(customerKey, {
            customer: customerName.trim() || 'Guest',
            email: order.buyer_email || 'N/A',
            platform: order.store_name || order.store_type,
            outstandingAmount: 0,
            invoiceCount: 0,
            lastOrderDate: order.created_at,
            status: order.financial_status || 'pending',
          });
        }
        
        const invoice = outstandingInvoicesMap.get(customerKey)!;
        invoice.outstandingAmount += parseFloat(order.total_price || '0');
        invoice.invoiceCount += 1;
        if (new Date(order.created_at) > new Date(invoice.lastOrderDate)) {
          invoice.lastOrderDate = order.created_at;
        }
      });

    const outstandingInvoices = Array.from(outstandingInvoicesMap.values())
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
      .slice(0, 10);

    // Calculate margins (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentOrders = orders.filter((order: any) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= thirtyDaysAgo;
    });

    const totalRevenue = recentOrders.reduce((sum: number, order: any) => 
      sum + parseFloat(order.total_price || '0'), 0);
    const estimatedCOGS = totalRevenue * 0.6;
    const grossMarginDollars = totalRevenue - estimatedCOGS;
    const grossMarginPercent = totalRevenue > 0 ? (grossMarginDollars / totalRevenue) * 100 : 0;

    // Daily margins for last 7 days
    const dailyMargins = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayOrders = orders.filter((o: any) => {
        const orderDate = new Date(o.created_at);
        return orderDate >= date && orderDate < nextDate;
      });
      
      const dayRevenue = dayOrders.reduce((sum: number, o: any) => 
        sum + parseFloat(o.total_price || '0'), 0);
      const dayCOGS = dayRevenue * 0.6;
      const dayMargin = dayRevenue - dayCOGS;
      
      dailyMargins.push({
        date: date.toISOString().split('T')[0],
        revenue: dayRevenue,
        margin: dayMargin,
        marginPercent: dayRevenue > 0 ? (dayMargin / dayRevenue) * 100 : 0,
      });
    }

    // Get products for inventory calculation
    const productsSql = `
      SELECT 
        product_id,
        store_name,
        store_type,
        variants
      FROM dashboard.products
      ${whereClause}
    `;
    const productsResult = await query(productsSql, params);
    const products = productsResult.rows;

    // Calculate inventory value
    const totalInventoryValue = products.reduce((sum: number, product: any) => {
      const variants = product.variants || [];
      return sum + variants.reduce((variantSum: number, variant: any) => {
        return variantSum + (variant.inventory_quantity || 0) * parseFloat(variant.price || '0');
      }, 0);
    }, 0);

    const platformValuesMap = new Map<string, { value: number; items: number }>();
    
    products.forEach((product: any) => {
      const platform = product.store_name || product.store_type || 'Unknown';
      if (!platformValuesMap.has(platform)) {
        platformValuesMap.set(platform, { value: 0, items: 0 });
      }
      
      const platformData = platformValuesMap.get(platform)!;
      const variants = product.variants || [];
      const productValue = variants.reduce((sum: number, variant: any) => 
        sum + (variant.inventory_quantity || 0) * parseFloat(variant.price || '0'), 0);
      const productItems = variants.reduce((sum: number, v: any) => 
        sum + (v.inventory_quantity || 0), 0);
      
      platformData.value += productValue;
      platformData.items += productItems;
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
