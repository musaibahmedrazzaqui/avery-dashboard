// lib/sync-all-stores.ts
import { syncEbayOrders, syncEbayProducts, syncEbayCustomers } from './ebay-sync';
import { syncShopifyOrders, syncShopifyProducts, syncShopifyCustomers, getShopifyStores } from './shopify-sync';

interface SyncResult {
  success: boolean;
  totalOrdersSynced: number;
  totalProductsSynced: number;
  totalCustomersSynced: number;
  errors: string[];
}

/**
 * Sync ALL stores: eBay FIRST → Shopify SECOND
 * @param isInitialSync - If true, syncs historical data (default: last 60 days)
 */
export async function syncAllStores(isInitialSync: boolean = false): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    totalOrdersSynced: 0,
    totalProductsSynced: 0,
    totalCustomersSynced: 0,
    errors: [],
  };

  console.log(`Starting ${isInitialSync ? 'FULL HISTORICAL' : 'DAILY'} sync (eBay first → Shopify second)`);

  // ===================================================================
  // 1. SYNC EBAY FIRST (Highest priority)
  // ===================================================================
  const ebayToken = process.env.EBAY_AUTHN_AUTH_TOKEN || process.env.EBAY_USER_TOKEN || process.env.OAUTH_TOKEN || '';

  if (ebayToken) {
    const ebayConfig = {
      appId: process.env.EBAY_APP_ID || '',
      certId: process.env.EBAY_CERT_ID || '',
      oauthToken: ebayToken,
    };

    try {
      console.log('Syncing eBay...');

      // Determine date range for eBay (max 90 days historical)
      const now = new Date();
      let ebayDateFrom: Date;
      if (isInitialSync) {
        const days = Math.min(parseInt(process.env.INITIAL_SYNC_DAYS || '60', 10), 90);
        ebayDateFrom = new Date(now);
        ebayDateFrom.setDate(ebayDateFrom.getDate() - days);
      } else {
        ebayDateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }

      // 1. Sync eBay Orders
      const orderResult = await syncEbayOrders(ebayConfig, 'eBay', ebayDateFrom, undefined, isInitialSync);
      if (orderResult.success) {
        result.totalOrdersSynced += orderResult.ordersSynced;
        console.log(`eBay Orders: ${orderResult.ordersSynced} synced`);
      } else {
        result.errors.push(`eBay Orders: ${orderResult.error}`);
        console.warn(`eBay orders sync failed: ${orderResult.error}`);
      }

      // 2. Sync eBay Products
      const productResult = await syncEbayProducts(ebayConfig, 'eBay');
      if (productResult.success) {
        result.totalProductsSynced += productResult.productsSynced;
        console.log(`eBay Products: ${productResult.productsSynced} synced`);
      } else {
        result.errors.push(`eBay Products: ${productResult.error || 'Unknown error'}`);
      }

      // 3. Sync eBay Customers (from orders)
      const customerResult = await syncEbayCustomers('eBay');
      if (customerResult.success) {
        result.totalCustomersSynced += customerResult.customersSynced;
        console.log(`eBay Customers: ${customerResult.customersSynced} synced`);
      } else {
        result.errors.push(`eBay Customers: ${customerResult.error || 'Unknown error'}`);
      }

    } catch (error: any) {
      const msg = `eBay sync crashed: ${error.message}`;
      result.errors.push(msg);
      console.error(msg, error);
      result.success = false;
    }
  } else {
    console.warn('eBay token missing. Skipping eBay sync. Set EBAY_AUTHN_AUTH_TOKEN in .env');
  }

  // ===================================================================
  // 2. THEN SYNC ALL SHOPIFY STORES
  // ===================================================================
  const shopifyStores = getShopifyStores();
  console.log(`Found ${shopifyStores.length} Shopify store(s)`);

  for (const store of shopifyStores) {
    try {
      console.log(`Syncing Shopify store: ${store.name} (${store.domain})`);

      // Determine date range for Shopify
      let shopifyDateFrom: Date | undefined;
      if (isInitialSync) {
        const days = parseInt(process.env.INITIAL_SYNC_DAYS || '60', 10);
        shopifyDateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      } else {
        shopifyDateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }

      // 1. Orders
      const orderResult = await syncShopifyOrders(store, shopifyDateFrom);
      if (orderResult.success) {
        result.totalOrdersSynced += orderResult.ordersSynced;
        console.log(`${store.name}: ${orderResult.ordersSynced} orders`);
      } else {
        result.errors.push(`${store.name} Orders: ${orderResult.error}`);
      }

      // 2. Products
      const productResult = await syncShopifyProducts(store);
      if (productResult.success) {
        result.totalProductsSynced += productResult.productsSynced;
        console.log(`${store.name}: ${productResult.productsSynced} products`);
      } else {
        result.errors.push(`${store.name} Products: ${productResult.error || 'Failed'}`);
      }

      // 3. Customers
      const customerResult = await syncShopifyCustomers(store);
      if (customerResult.success) {
        result.totalCustomersSynced += customerResult.customersSynced;
        console.log(`${store.name}: ${customerResult.customersSynced} customers`);
      } else {
        result.errors.push(`${store.name} Customers: ${customerResult.error || 'Failed'}`);
      }

    } catch (error: any) {
      const msg = `${store.name}: ${error.message}`;
      result.errors.push(msg);
      console.error(`Shopify sync error (${store.name}):`, error);
      result.success = false;
    }
  }

  // ===================================================================
  // FINAL RESULT
  // ===================================================================
  console.log('SYNC COMPLETE');
  console.log(`   Orders synced: ${result.totalOrdersSynced}`);
  console.log(`   Products synced: ${result.totalProductsSynced}`);
  console.log(`   Customers synced: ${result.totalCustomersSynced}`);

  if (result.errors.length > 0) {
    console.error(`Errors (${result.errors.length}):`);
    result.errors.forEach(e => console.error(`   • ${e}`));
  }

  // Only mark as failed if nothing synced at all
  if (result.totalOrdersSynced === 0 && result.totalProductsSynced === 0 && result.totalCustomersSynced === 0) {
    result.success = false;
  }

  return result;
}