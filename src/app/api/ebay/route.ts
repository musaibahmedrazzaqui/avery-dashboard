import { EbayBuyer, EbayOrder } from '@/lib/ebay';
import { NextRequest, NextResponse } from 'next/server';
import { getCachedEbayToken } from '@/lib/ebay-auth';

const EBAY_CONFIG = {
  APP_ID: process.env.EBAY_APP_ID || '',
  CERT_ID: process.env.EBAY_CERT_ID || '',
  CLIENT_SECRET: process.env.EBAY_CLIENT_SECRET || '',
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  // Check if eBay is configured (either token or credentials for dynamic token)
  const hasToken = !!(process.env.OAUTH_TOKEN || process.env.EBAY_USER_TOKEN);
  const hasCredentials = !!(EBAY_CONFIG.APP_ID && EBAY_CONFIG.CLIENT_SECRET);
  
  if (!hasToken && !hasCredentials) {
    return NextResponse.json(
      { error: 'eBay credentials not configured. Need either OAUTH_TOKEN or EBAY_APP_ID + EBAY_CLIENT_SECRET' },
      { status: 503 }
    );
  }

  try {
    console.log(`Making eBay API call: ${endpoint}`);
    
    // For orders, products, and buyers, return data from database if available
    // Otherwise return empty (they should use sync endpoint to populate)
    if (endpoint === 'orders') {
      // Try to get from database first
      try {
        const { query, isDatabaseAvailable } = await import('@/lib/db');
        if (isDatabaseAvailable()) {
          const result = await query(
            'SELECT * FROM dashboard.orders WHERE store_type = $1 ORDER BY created_at DESC LIMIT 100',
            ['ebay']
          );
          const orders = result.rows.map((row: any) => ({
            orderId: row.order_id,
            transactionId: row.order_id,
            totalPrice: row.total_price.toString(),
            creationDate: row.created_at.toISOString(),
            orderStatus: row.order_status || 'Active',
            buyer: {
              username: row.buyer_username || '',
              email: row.buyer_email || '',
            },
            shippingAddress: row.shipping_address || {},
            lineItems: row.line_items || [],
          }));
          return NextResponse.json({ orders });
        }
      } catch (dbError: any) {
        console.warn('Database query failed, returning empty:', dbError.message);
      }
      return NextResponse.json({ orders: [] });
    }
    
    if (endpoint === 'products') {
      // Products not yet synced, return empty
      return NextResponse.json({ products: [] });
    }
    
    if (endpoint === 'buyers') {
      // Try to get from database
      try {
        const { query, isDatabaseAvailable } = await import('@/lib/db');
        if (isDatabaseAvailable()) {
          const result = await query(
            `SELECT DISTINCT buyer_username, buyer_email, shipping_address 
             FROM dashboard.orders 
             WHERE store_type = $1 AND buyer_username IS NOT NULL 
             LIMIT 100`,
            ['ebay']
          );
          const buyers = result.rows.map((row: any) => ({
            username: row.buyer_username,
            email: row.buyer_email || '',
            feedbackScore: 0,
            registrationDate: new Date().toISOString(),
            address: row.shipping_address || {},
          }));
          return NextResponse.json({ buyers });
        }
      } catch (dbError: any) {
        console.warn('Database query failed, returning empty:', dbError.message);
      }
      return NextResponse.json({ buyers: [] });
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    
  } catch (error: any) {
    console.error('eBay API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
