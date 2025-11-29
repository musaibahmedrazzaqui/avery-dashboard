import { query } from '../db';

interface ShopifyStore {
  name: string;
  domain: string;
  accessToken: string;
}

interface ShopifyOrder {
  id: number;
  order_number: string;
  total_price: string;
  created_at: string;
  fulfillment_status: string | null;
  financial_status: string;
  line_items: any[];
  customer: any;
  shipping_address: any;
  tags: string[];
}

/**
 * Fetch orders from Shopify API
 */
async function fetchShopifyOrders(
  store: ShopifyStore,
  createdAtMin?: string,
  limit: number = 250,
  pageInfo?: string
): Promise<{ orders: ShopifyOrder[]; nextPageInfo?: string; hasNextPage: boolean }> {
  try {
    let url: string;
    if (pageInfo) {
      // Use page_info for pagination (Shopify's recommended method)
      url = `https://${store.domain}/admin/api/2024-07/orders.json?limit=${limit}&page_info=${pageInfo}`;
    } else {
      url = `https://${store.domain}/admin/api/2024-07/orders.json?status=any&limit=${limit}`;
      if (createdAtMin) {
        url += `&created_at_min=${createdAtMin}`;
      }
    }

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    const orders = data.orders || [];

    // Check for next page using link header
    const linkHeader = response.headers.get('link');
    let nextPageInfo: string | undefined;
    let hasNextPage = false;

    if (linkHeader) {
      // Parse link header: <https://...>; rel="next"
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        const nextUrl = new URL(nextMatch[1]);
        nextPageInfo = nextUrl.searchParams.get('page_info') || undefined;
        hasNextPage = !!nextPageInfo;
      }
    }

    return { orders, nextPageInfo, hasNextPage };
  } catch (error: any) {
    console.error(`Error fetching Shopify orders from ${store.name}:`, error);
    throw error;
  }
}

/**
 * Fetch all orders from Shopify (handles pagination)
 */
async function fetchAllShopifyOrders(
  store: ShopifyStore,
  createdAtMin?: string
): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = [];
  let page = 1;
  let hasMore = true;
  let nextPageInfo: string | undefined;

  while (hasMore) {
    try {
      const result = await fetchShopifyOrders(store, createdAtMin, 250, nextPageInfo);
      allOrders.push(...result.orders);

      console.log(`📄 ${store.name} - Page ${page}: ${result.orders.length} orders`);

      if (result.hasNextPage && result.nextPageInfo) {
        nextPageInfo = result.nextPageInfo;
        page++;
        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        hasMore = false;
      }
    } catch (error: any) {
      console.error(`Error on page ${page}:`, error);
      hasMore = false;
    }
  }

  return allOrders;
}

/**
 * Sync Shopify orders to database
 */
export async function syncShopifyOrders(
  store: ShopifyStore,
  dateFrom?: Date
): Promise<{ success: boolean; ordersSynced: number; error?: string }> {
  try {
    // Check if database is available
    const { isDatabaseAvailable } = await import('../db');
    if (!isDatabaseAvailable()) {
      return {
        success: false,
        ordersSynced: 0,
        error: 'Database not configured or unavailable',
      };
    }

    // Check if table is empty for this store
    const countResult = await query(
      'SELECT COUNT(*) as count FROM dashboard.orders WHERE store_type = $1 AND store_name = $2',
      ['shopify', store.name]
    );
    const isEmpty = parseInt(countResult.rows[0].count) === 0;

    // Determine date range
    // For initial sync (full historical), don't set createdAtMin to get all orders
    // For daily sync, use dateFrom
    const createdAtMin = dateFrom ? dateFrom.toISOString() : undefined;

    console.log(`📅 Syncing Shopify orders from ${store.name}${createdAtMin ? ` since ${createdAtMin}` : ' (all historical)'}`);

    // Fetch orders
    const orders = await fetchAllShopifyOrders(store, createdAtMin);

    console.log(`✅ Fetched ${orders.length} orders from ${store.name}`);

    // Save orders to database
    let syncedCount = 0;
    for (const order of orders) {
      try {
        await query(
          `INSERT INTO dashboard.orders (
            order_id, store_type, store_name, order_number, total_price, created_at,
            fulfillment_status, financial_status, buyer_username, buyer_email,
            shipping_address, line_items, raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (order_id) 
          DO UPDATE SET
            total_price = EXCLUDED.total_price,
            fulfillment_status = EXCLUDED.fulfillment_status,
            financial_status = EXCLUDED.financial_status,
            shipping_address = EXCLUDED.shipping_address,
            line_items = EXCLUDED.line_items,
            raw_data = EXCLUDED.raw_data,
            synced_at = CURRENT_TIMESTAMP`,
          [
            `shopify_${order.id}`,
            'shopify',
            store.name,
            order.order_number || order.id.toString(),
            parseFloat(order.total_price) || 0,
            new Date(order.created_at),
            order.fulfillment_status,
            order.financial_status,
            order.customer?.first_name || null,
            order.customer?.email || null,
            JSON.stringify(order.shipping_address || {}),
            JSON.stringify(order.line_items || []),
            JSON.stringify(order),
          ]
        );
        syncedCount++;
      } catch (error: any) {
        console.error(`Error saving order ${order.id}:`, error.message);
      }
    }

    console.log(`✅ Synced ${syncedCount} Shopify orders from ${store.name} to database`);

    return {
      success: true,
      ordersSynced: syncedCount,
    };
  } catch (error: any) {
    console.error(`❌ Error syncing Shopify orders from ${store.name}:`, error);
    return {
      success: false,
      ordersSynced: 0,
      error: error.message,
    };
  }
}

/**
 * Fetch inventory item cost from Shopify API
 */
async function fetchShopifyInventoryItemCost(
  store: ShopifyStore,
  inventoryItemId: string
): Promise<number | null> {
  try {
    const url = `https://${store.domain}/admin/api/2024-07/inventory_items/${inventoryItemId}.json`;
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const cost = data.inventory_item?.cost;
    return cost ? parseFloat(cost) : null;
  } catch (error: any) {
    console.error(`Error fetching inventory item cost for ${inventoryItemId}:`, error.message);
    return null;
  }
}

/**
 * Fetch costs for all inventory items in batch
 */
async function fetchShopifyInventoryItemCosts(
  store: ShopifyStore,
  inventoryItemIds: string[]
): Promise<Map<string, number | null>> {
  const costMap = new Map<string, number | null>();
  
  // Fetch costs in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < inventoryItemIds.length; i += batchSize) {
    const batch = inventoryItemIds.slice(i, i + batchSize);
    const promises = batch.map(async (id) => {
      const cost = await fetchShopifyInventoryItemCost(store, id);
      return { id, cost };
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ id, cost }) => {
      costMap.set(id, cost);
    });
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < inventoryItemIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  
  return costMap;
}

/**
 * Fetch products from Shopify API
 */
async function fetchAllShopifyProducts(
  store: ShopifyStore
): Promise<any[]> {
  const allProducts: any[] = [];
  let page = 1;
  let hasMore = true;
  let nextPageInfo: string | undefined;

  while (hasMore && page <= 100) { // Safety limit
    try {
      let url: string;
      if (nextPageInfo) {
        url = `https://${store.domain}/admin/api/2024-07/products.json?limit=250&page_info=${nextPageInfo}`;
      } else {
        url = `https://${store.domain}/admin/api/2024-07/products.json?limit=250`;
      }

      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': store.accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Error fetching products from ${store.name}: ${response.status}`);
        break;
      }

      const data = await response.json();
      const products = data.products || [];
      allProducts.push(...products);

      console.log(`📄 ${store.name} Products - Page ${page}: ${products.length} products`);

      // Check for next page
      const linkHeader = response.headers.get('link');
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          const nextUrl = new URL(nextMatch[1]);
          nextPageInfo = nextUrl.searchParams.get('page_info') || undefined;
          hasMore = !!nextPageInfo;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      if (hasMore) {
        page++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      console.error(`Error on page ${page}:`, error);
      hasMore = false;
    }
  }

  return allProducts;
}

/**
 * Fetch customers from Shopify API
 */
async function fetchAllShopifyCustomers(
  store: ShopifyStore
): Promise<any[]> {
  const allCustomers: any[] = [];
  let page = 1;
  let hasMore = true;
  let nextPageInfo: string | undefined;

  while (hasMore && page <= 100) { // Safety limit
    try {
      let url: string;
      if (nextPageInfo) {
        url = `https://${store.domain}/admin/api/2024-07/customers.json?limit=250&page_info=${nextPageInfo}`;
      } else {
        url = `https://${store.domain}/admin/api/2024-07/customers.json?limit=250`;
      }

      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': store.accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Error fetching customers from ${store.name}: ${response.status}`);
        break;
      }

      const data = await response.json();
      const customers = data.customers || [];
      allCustomers.push(...customers);

      console.log(`📄 ${store.name} Customers - Page ${page}: ${customers.length} customers`);

      // Check for next page
      const linkHeader = response.headers.get('link');
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          const nextUrl = new URL(nextMatch[1]);
          nextPageInfo = nextUrl.searchParams.get('page_info') || undefined;
          hasMore = !!nextPageInfo;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      if (hasMore) {
        page++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      console.error(`Error on page ${page}:`, error);
      hasMore = false;
    }
  }

  return allCustomers;
}

/**
 * Sync Shopify products to database
 */
export async function syncShopifyProducts(
  store: ShopifyStore
): Promise<{ success: boolean; productsSynced: number; error?: string }> {
  try {
    const { isDatabaseAvailable } = await import('../db');
    if (!isDatabaseAvailable()) {
      return {
        success: false,
        productsSynced: 0,
        error: 'Database not configured or unavailable',
      };
    }

    console.log(`📦 Syncing Shopify products from ${store.name}...`);

    const products = await fetchAllShopifyProducts(store);
    console.log(`✅ Fetched ${products.length} products from ${store.name}`);

    // Collect all inventory item IDs to fetch costs in batch
    const inventoryItemIds: string[] = [];
    const productInventoryMap = new Map<number, string[]>(); // productId -> inventoryItemIds
    
    for (const product of products) {
      const variantInventoryIds: string[] = [];
      (product.variants || []).forEach((variant: any) => {
        if (variant.inventory_item_id) {
          const id = variant.inventory_item_id.toString();
          variantInventoryIds.push(id);
          if (!inventoryItemIds.includes(id)) {
            inventoryItemIds.push(id);
          }
        }
      });
      if (variantInventoryIds.length > 0) {
        productInventoryMap.set(product.id, variantInventoryIds);
      }
    }

    // Fetch costs for all inventory items
    console.log(`💰 Fetching costs for ${inventoryItemIds.length} inventory items...`);
    const costMap = await fetchShopifyInventoryItemCosts(store, inventoryItemIds);
    console.log(`✅ Fetched costs for ${Array.from(costMap.values()).filter(c => c !== null).length} inventory items`);

    let syncedCount = 0;
    for (const product of products) {
      try {
        // Convert tags to array format (handle both string and array)
        let tags: string[] = [];
        if (product.tags) {
          if (Array.isArray(product.tags)) {
            tags = product.tags;
          } else if (typeof product.tags === 'string') {
            // Split comma-separated string and trim each tag
            tags = product.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
          }
        }

        // Calculate average cost from inventory items
        const variantInventoryIds = productInventoryMap.get(product.id) || [];
        const variantCosts: number[] = [];
        
        variantInventoryIds.forEach((inventoryId) => {
          const cost = costMap.get(inventoryId);
          if (cost !== null && cost !== undefined) {
            variantCosts.push(cost);
          }
        });

        // Use average cost if available, otherwise null (will use fallback in profit calculation)
        const calculatedCost = variantCosts.length > 0
          ? variantCosts.reduce((sum, cost) => sum + cost, 0) / variantCosts.length
          : null;

        await query(
          `INSERT INTO dashboard.products (
            product_id, store_type, store_name, title, description, product_type,
            vendor, tags, variants, cost, raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (product_id, store_type, store_name) 
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            product_type = EXCLUDED.product_type,
            vendor = EXCLUDED.vendor,
            tags = EXCLUDED.tags,
            variants = EXCLUDED.variants,
            cost = EXCLUDED.cost,
            raw_data = EXCLUDED.raw_data,
            synced_at = CURRENT_TIMESTAMP`,
          [
            product.id.toString(),
            'shopify',
            store.name,
            product.title || '',
            product.body_html || '',
            product.product_type || '',
            product.vendor || '',
            tags, // Now properly formatted as array
            JSON.stringify(product.variants || []),
            calculatedCost,
            JSON.stringify(product),
          ]
        );
        syncedCount++;
      } catch (error: any) {
        console.error(`Error saving product ${product.id}:`, error.message);
      }
    }

    console.log(`✅ Synced ${syncedCount} Shopify products from ${store.name} to database`);

    return {
      success: true,
      productsSynced: syncedCount,
    };
  } catch (error: any) {
    console.error(`❌ Error syncing Shopify products from ${store.name}:`, error);
    return {
      success: false,
      productsSynced: 0,
      error: error.message,
    };
  }
}

/**
 * Sync Shopify customers to database
 */
export async function syncShopifyCustomers(
  store: ShopifyStore
): Promise<{ success: boolean; customersSynced: number; error?: string }> {
  try {
    const { isDatabaseAvailable } = await import('../db');
    if (!isDatabaseAvailable()) {
      return {
        success: false,
        customersSynced: 0,
        error: 'Database not configured or unavailable',
      };
    }

    console.log(`👥 Syncing Shopify customers from ${store.name}...`);

    const customers = await fetchAllShopifyCustomers(store);
    console.log(`✅ Fetched ${customers.length} customers from ${store.name}`);

    let syncedCount = 0;
    for (const customer of customers) {
      try {
        // Convert tags to array format (handle both string and array)
        let tags: string[] = [];
        if (customer.tags) {
          if (Array.isArray(customer.tags)) {
            tags = customer.tags;
          } else if (typeof customer.tags === 'string') {
            // Split comma-separated string and trim each tag
            tags = customer.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
          }
        }

        await query(
          `INSERT INTO dashboard.customers (
            customer_id, store_type, store_name, first_name, last_name, email,
            orders_count, total_spent, tags, addresses, raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (customer_id, store_type, store_name) 
          DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            email = EXCLUDED.email,
            orders_count = EXCLUDED.orders_count,
            total_spent = EXCLUDED.total_spent,
            tags = EXCLUDED.tags,
            addresses = EXCLUDED.addresses,
            raw_data = EXCLUDED.raw_data,
            synced_at = CURRENT_TIMESTAMP`,
          [
            customer.id.toString(),
            'shopify',
            store.name,
            customer.first_name || '',
            customer.last_name || '',
            customer.email || '',
            customer.orders_count || 0,
            parseFloat(customer.total_spent) || 0,
            tags, // Now properly formatted as array
            JSON.stringify(customer.addresses || []),
            JSON.stringify(customer),
          ]
        );
        syncedCount++;
      } catch (error: any) {
        console.error(`Error saving customer ${customer.id}:`, error.message);
      }
    }

    console.log(`✅ Synced ${syncedCount} Shopify customers from ${store.name} to database`);

    return {
      success: true,
      customersSynced: syncedCount,
    };
  } catch (error: any) {
    console.error(`❌ Error syncing Shopify customers from ${store.name}:`, error);
    return {
      success: false,
      customersSynced: 0,
      error: error.message,
    };
  }
}

/**
 * Get Shopify stores from environment variables
 */
export function getShopifyStores(): ShopifyStore[] {
  const stores: ShopifyStore[] = [];

  // Parse environment variables for Shopify stores
  // Format: STORE_NAME_STORE=domain.com and STORE_NAME_ACCESS_TOKEN=token
  const envKeys = Object.keys(process.env);
  const storeNames = new Set<string>();

  // Find all store names
  for (const key of envKeys) {
    if (key.endsWith('_STORE')) {
      const storeName = key.replace('_STORE', '').toLowerCase();
      storeNames.add(storeName);
    }
  }

  // Build store objects
  for (const storeName of storeNames) {
    const storeKey = `${storeName.toUpperCase()}_STORE`;
    const tokenKey = `${storeName.toUpperCase()}_ACCESS_TOKEN`;
    const domain = process.env[storeKey];
    const accessToken = process.env[tokenKey];

    if (domain && accessToken) {
      stores.push({
        name: storeName.charAt(0).toUpperCase() + storeName.slice(1),
        domain,
        accessToken,
      });
    }
  }

  return stores;
}

