import { NextResponse } from 'next/server';
import { getShopifyStores } from '@/lib/sync/shopify-sync';

/**
 * GET /api/stores - Get all configured stores dynamically
 */
export async function GET() {
  try {
    const stores: Array<{ name: string; domain: string }> = [
      { name: 'All', domain: 'all' },
    ];

    // Get Shopify stores
    const shopifyStores = getShopifyStores();
    shopifyStores.forEach((store) => {
      stores.push({ name: store.name, domain: store.domain });
    });

    // Add eBay if configured (check all possible token env vars)
    if (process.env.EBAY_AUTHN_AUTH_TOKEN || process.env.OAUTH_TOKEN || process.env.EBAY_USER_TOKEN) {
      stores.push({ name: 'eBay', domain: 'ebay' });
    }

    return NextResponse.json({ stores });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stores: [{ name: 'All', domain: 'all' }] },
      { status: 500 }
    );
  }
}

