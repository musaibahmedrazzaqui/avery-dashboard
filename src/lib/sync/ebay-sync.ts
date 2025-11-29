import https from 'https';
import { DOMParser } from '@xmldom/xmldom';
import { query } from '../db';
import { getCachedEbayToken, clearEbayTokenCache } from '../ebay-auth';

interface EbayConfig {
  appId: string;
  certId: string;
  oauthToken: string;
}

interface EbayOrder {
  OrderID: string;
  OrderStatus: string;
  CreatedTime: string;
  Total: {
    value: string;
    currencyID: string;
  };
  BuyerUserID: string;
  TransactionArray?: {
    Transaction: any[];
  };
  ShippingAddress?: any;
}

/**
 * Make raw HTTP request to eBay Trading API (matching test-ebay-getorders-raw.js)
 */
function makeRawGetOrdersRequest(
  config: EbayConfig,
  createTimeFrom: Date,
  createTimeTo: Date,
  pageNumber: number = 1
): Promise<{ statusCode: number; xml: string }> {
  return new Promise((resolve, reject) => {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <CreateTimeFrom>${createTimeFrom.toISOString()}</CreateTimeFrom>
  <CreateTimeTo>${createTimeTo.toISOString()}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>All</OrderStatus>
  <Pagination>
    <EntriesPerPage>100</EntriesPerPage>
    <PageNumber>${pageNumber}</PageNumber>
  </Pagination>
</GetOrdersRequest>`;

    const headers = {
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1421',
      'X-EBAY-API-CALL-NAME': 'GetOrders',
      'X-EBAY-API-IAF-TOKEN': config.oauthToken,
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(xmlBody).toString(),
    };

    const options = {
      hostname: 'api.ebay.com',
      port: 443,
      path: '/ws/api.dll',
      method: 'POST',
      headers: headers,
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 200,
          xml: responseData,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(xmlBody);
    req.end();
  });
}

/**
 * Parse XML response to extract orders
 */
function parseOrdersFromXML(xmlResponse: string): {
  orders: EbayOrder[];
  pagination: {
    TotalNumberOfPages: number;
    TotalNumberOfEntries: number;
    PageNumber: number;
  } | null;
  hasMoreOrders: boolean;
  errors: any[] | null;
} {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

    // Check for errors
    const errors = xmlDoc.getElementsByTagName('Errors');
    if (errors.length > 0) {
      const errorMessages = [];
      for (let i = 0; i < errors.length; i++) {
        const error = errors[i];
        const severity = error.getElementsByTagName('SeverityCode')[0]?.textContent || 'Unknown';
        const shortMessage = error.getElementsByTagName('ShortMessage')[0]?.textContent || 'Unknown error';
        const longMessage = error.getElementsByTagName('LongMessage')[0]?.textContent || '';
        errorMessages.push({ severity, shortMessage, longMessage });
      }
      return { orders: [], pagination: null, hasMoreOrders: false, errors: errorMessages };
    }

    const orders: EbayOrder[] = [];
    const orderArray = xmlDoc.getElementsByTagName('OrderArray')[0];

    if (orderArray) {
      const orderNodes = orderArray.getElementsByTagName('Order');
      for (let i = 0; i < orderNodes.length; i++) {
        const orderNode = orderNodes[i];
        const order: EbayOrder = {
          OrderID: getTextContent(orderNode, 'OrderID') || '',
          OrderStatus: getTextContent(orderNode, 'OrderStatus') || '',
          CreatedTime: getTextContent(orderNode, 'CreatedTime') || new Date().toISOString(),
          Total: {
            value: getTextContent(orderNode, 'Total') || 
                   (orderNode.getElementsByTagName('Total')[0]?.getElementsByTagName('value')[0]?.textContent || '0.00'),
            currencyID: orderNode.getElementsByTagName('Total')[0]?.getAttribute('currencyID') || 'USD',
          },
          BuyerUserID: getTextContent(orderNode, 'BuyerUserID') || '',
        };

        // Get transaction array
        const transactionArray = orderNode.getElementsByTagName('TransactionArray')[0];
        if (transactionArray) {
          order.TransactionArray = {
            Transaction: Array.from(transactionArray.getElementsByTagName('Transaction')).map((tx) => {
              const item = tx.getElementsByTagName('Item')[0];
              return {
                TransactionID: getTextContent(tx, 'TransactionID'),
                Item: {
                  ItemID: getTextContent(item, 'ItemID'),
                  Title: getTextContent(item, 'Title'),
                  SKU: getTextContent(item, 'SKU'),
                },
                QuantityPurchased: parseInt(getTextContent(tx, 'QuantityPurchased') || '1'),
                TransactionPrice: getTextContent(tx, 'TransactionPrice') || 
                                  (tx.getElementsByTagName('TransactionPrice')[0]?.getElementsByTagName('value')[0]?.textContent || '0.00'),
              };
            }),
          };
        }

        // Get shipping address
        const shippingAddress = orderNode.getElementsByTagName('ShippingAddress')[0];
        if (shippingAddress) {
          order.ShippingAddress = {
            Street1: getTextContent(shippingAddress, 'Street1'),
            CityName: getTextContent(shippingAddress, 'CityName'),
            StateOrProvince: getTextContent(shippingAddress, 'StateOrProvince'),
            Country: getTextContent(shippingAddress, 'Country'),
            PostalCode: getTextContent(shippingAddress, 'PostalCode'),
          };
        }

        orders.push(order);
      }
    }

    // Get pagination info
    const paginationResult = xmlDoc.getElementsByTagName('PaginationResult')[0];
    const hasMoreOrders = xmlDoc.getElementsByTagName('HasMoreOrders')[0]?.textContent === 'true';

    const pagination = paginationResult
      ? {
          TotalNumberOfPages: parseInt(getTextContent(paginationResult, 'TotalNumberOfPages') || '1'),
          TotalNumberOfEntries: parseInt(getTextContent(paginationResult, 'TotalNumberOfEntries') || '0'),
          PageNumber: parseInt(getTextContent(paginationResult, 'PageNumber') || '1'),
        }
      : null;

    return {
      orders,
      pagination,
      hasMoreOrders,
      errors: null,
    };
  } catch (error: any) {
    return {
      orders: [],
      pagination: null,
      hasMoreOrders: false,
      errors: [{ shortMessage: 'XML Parse Error', longMessage: error.message }],
    };
  }
}

function getTextContent(parentNode: any, tagName: string): string | null {
  const node = parentNode.getElementsByTagName(tagName)[0];
  return node ? node.textContent : null;
}

/**
 * Sync eBay orders to database
 */
export async function syncEbayOrders(
  config: EbayConfig,
  storeName: string = 'eBay',
  dateFrom?: Date,
  dateTo?: Date,
  isFullSync: boolean = false
): Promise<{ success: boolean; ordersSynced: number; error?: string }> {
  try {
    // Get token - always prefer Auth'n'Auth token from environment if available
    const envAuthnAuthToken = process.env.EBAY_AUTHN_AUTH_TOKEN || process.env.OAUTH_TOKEN || process.env.EBAY_USER_TOKEN;
    let oauthToken = envAuthnAuthToken || config.oauthToken;
    
    if (!oauthToken) {
      try {
        oauthToken = await getCachedEbayToken();
      } catch (error: any) {
        return {
          success: false,
          ordersSynced: 0,
          error: `Failed to get eBay token: ${error.message}`,
        };
      }
    }

    if (!oauthToken || oauthToken.trim().length === 0) {
      return {
        success: false,
        ordersSynced: 0,
        error: 'eBay token is empty',
      };
    }

    const updatedConfig = { ...config, oauthToken };
    const { isDatabaseAvailable } = await import('../db');
    if (!isDatabaseAvailable()) {
      return {
        success: false,
        ordersSynced: 0,
        error: 'Database not configured or unavailable',
      };
    }

    const now = new Date();
    const createTimeTo = dateTo ? new Date(dateTo) : new Date(now);
    createTimeTo.setUTCHours(23, 59, 59, 999);

    let createTimeFrom: Date;
    if (isFullSync || dateFrom) {
      const initialSyncDays = Math.min(
        parseInt(process.env.INITIAL_SYNC_DAYS || '60'),
        90
      );
      createTimeFrom = dateFrom || new Date(now);
      createTimeFrom.setDate(createTimeFrom.getDate() - initialSyncDays);
      createTimeFrom.setUTCHours(0, 0, 0, 0);
    } else {
      createTimeFrom = new Date(now);
      createTimeFrom.setDate(createTimeFrom.getDate() - 1);
      createTimeFrom.setUTCHours(0, 0, 0, 0);
    }

    let allOrders: EbayOrder[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    let authRetryCount = 0;
    const maxAuthRetries = 1;
    const maxPages = isFullSync ? 500 : 50;

    while (hasMorePages && currentPage <= maxPages) {
      console.log(`📄 Fetching eBay page ${currentPage}...`);

      const response = await makeRawGetOrdersRequest(updatedConfig, createTimeFrom, createTimeTo, currentPage);
      
      if (response.statusCode !== 200) {
        console.error(`❌ eBay API HTTP Error: ${response.statusCode}`);
        break;
      }

      const parsedResult = parseOrdersFromXML(response.xml);

      if (parsedResult.errors && parsedResult.errors.length > 0) {
        console.error('❌ eBay API Errors:', parsedResult.errors);
        
        const authError = parsedResult.errors.find((e: any) => 
          e.shortMessage?.includes('Auth token is invalid') ||
          e.shortMessage?.includes('authentication token')
        );
        
        if (authError) {
          if (authRetryCount >= maxAuthRetries) {
            return {
              success: false,
              ordersSynced: 0,
              error: 'eBay Trading API authentication failed after retries',
            };
          }

          const isAuthnAuth = !!(process.env.EBAY_AUTHN_AUTH_TOKEN || process.env.OAUTH_TOKEN || process.env.EBAY_USER_TOKEN);
          if (isAuthnAuth && currentPage === 1) {
            authRetryCount++;
            clearEbayTokenCache();
            const envToken = process.env.EBAY_AUTHN_AUTH_TOKEN || process.env.OAUTH_TOKEN || process.env.EBAY_USER_TOKEN || '';
            if (envToken) {
              updatedConfig.oauthToken = envToken;
              allOrders = [];
              currentPage = 1;
              continue;
            }
          }
          
          return {
            success: false,
            ordersSynced: 0,
            error: 'eBay Trading API authentication failed',
          };
        }
        
        if (allOrders.length === 0) {
          return {
            success: false,
            ordersSynced: 0,
            error: parsedResult.errors.map((e) => e.shortMessage).join(', '),
          };
        }
        break;
      }

      const orders = parsedResult.orders || [];
      allOrders = allOrders.concat(orders);

      if (parsedResult.pagination) {
        if (currentPage >= parsedResult.pagination.TotalNumberOfPages || orders.length === 0) {
          hasMorePages = false;
        } else {
          currentPage++;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } else if (parsedResult.hasMoreOrders) {
        currentPage++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        hasMorePages = false;
      }
    }

    let syncedCount = 0;
    for (const order of allOrders) {
      try {
        const lineItems = (order.TransactionArray?.Transaction || []).map((tx: any) => ({
          itemId: tx.Item?.ItemID || '',
          title: tx.Item?.Title || '',
          quantity: tx.QuantityPurchased || 1,
          price: tx.TransactionPrice || '0.00',
          sku: tx.Item?.SKU || '',
        }));

        await query(
          `INSERT INTO dashboard.orders (
            order_id, store_type, store_name, order_number, total_price, created_at,
            order_status, buyer_username, shipping_address, line_items, raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (order_id) 
          DO UPDATE SET
            total_price = EXCLUDED.total_price,
            order_status = EXCLUDED.order_status,
            shipping_address = EXCLUDED.shipping_address,
            line_items = EXCLUDED.line_items,
            raw_data = EXCLUDED.raw_data,
            synced_at = CURRENT_TIMESTAMP`,
          [
            order.OrderID,
            'ebay',
            storeName,
            order.OrderID,
            parseFloat(order.Total.value) || 0,
            new Date(order.CreatedTime),
            order.OrderStatus,
            order.BuyerUserID,
            JSON.stringify(order.ShippingAddress || {}),
            JSON.stringify(lineItems),
            JSON.stringify(order),
          ]
        );
        syncedCount++;
      } catch (error: any) {
        console.error(`Error saving order ${order.OrderID}:`, error.message);
      }
    }

    console.log(`✅ Synced ${syncedCount} eBay orders to database`);

    return {
      success: true,
      ordersSynced: syncedCount,
    };
  } catch (error: any) {
    console.error('❌ Error syncing eBay orders:', error);
    return {
      success: false,
      ordersSynced: 0,
      error: error.message,
    };
  }
}

/**
 * FINAL FIXED VERSION - Works 100% with Auth'n'Auth tokens (2025)
 */
function makeRawGetSellerListRequest(
  config: EbayConfig,
  pageNumber: number = 1,
  startTimeFrom?: Date
): Promise<{ statusCode: number; xml: string }> {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const endTimeFrom = startTimeFrom || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endTimeTo = new Date();

    endTimeFrom.setUTCHours(0, 0, 0, 0);
    endTimeTo.setUTCHours(23, 59, 59, 999);

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${config.oauthToken}</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <EndTimeFrom>${endTimeFrom.toISOString()}</EndTimeFrom>
  <EndTimeTo>${endTimeTo.toISOString()}</EndTimeTo>
  <Pagination>
    <EntriesPerPage>200</EntriesPerPage>
    <PageNumber>${pageNumber}</PageNumber>
  </Pagination>
</GetSellerListRequest>`;

    const headers = {
      'X-EBAY-API-SITEID': '0',              // REQUIRED — even if empty string!
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1421',
      'X-EBAY-API-CALL-NAME': 'GetSellerList',
      'X-EBAY-API-IAF-TOKEN': config.oauthToken,
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(xmlBody).toString(),
    };

    const options = {
      hostname: 'api.ebay.com',
      path: '/ws/api.dll',
      method: 'POST',
      headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 200, xml: data });
      });
    });

    req.on('error', reject);
    req.write(xmlBody);
    req.end();
  });
}

/**
* Parse XML response to extract products/listings
*/
function parseProductsFromXML(xmlResponse: string): {
products: any[];
pagination: {
  TotalNumberOfPages: number;
  TotalNumberOfEntries: number;
  PageNumber: number;
} | null;
errors: any[] | null;
} {
try {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');

  // Check for errors
  const errors = xmlDoc.getElementsByTagName('Errors');
  if (errors.length > 0) {
    const errorMessages = [];
    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];
      const severity = error.getElementsByTagName('SeverityCode')[0]?.textContent || 'Unknown';
      const shortMessage = error.getElementsByTagName('ShortMessage')[0]?.textContent || 'Unknown error';
      const longMessage = error.getElementsByTagName('LongMessage')[0]?.textContent || '';
      errorMessages.push({ severity, shortMessage, longMessage });
    }
    return { products: [], pagination: null, errors: errorMessages };
  }

  const products: any[] = [];
  const itemArray = xmlDoc.getElementsByTagName('ItemArray')[0];

  if (itemArray) {
    const itemNodes = itemArray.getElementsByTagName('Item');
    for (let i = 0; i < itemNodes.length; i++) {
      const itemNode = itemNodes[i];
      const product = {
        ItemID: getTextContent(itemNode, 'ItemID') || '',
        Title: getTextContent(itemNode, 'Title') || '',
        Description: getTextContent(itemNode, 'Description') || '',
        SKU: getTextContent(itemNode, 'SKU') || '',
        Quantity: parseInt(getTextContent(itemNode, 'Quantity') || '0'),
        ListingType: getTextContent(itemNode, 'ListingType') || '',
        ListingStatus: getTextContent(itemNode, 'ListingStatus') || '',
        CurrentPrice: {
          value: getTextContent(itemNode, 'CurrentPrice') || 
                 (itemNode.getElementsByTagName('CurrentPrice')[0]?.getElementsByTagName('value')[0]?.textContent || '0.00'),
          currencyID: itemNode.getElementsByTagName('CurrentPrice')[0]?.getAttribute('currencyID') || 'USD',
        },
        QuantitySold: parseInt(getTextContent(itemNode, 'QuantitySold') || '0'),
        PrimaryCategory: {
          CategoryID: getTextContent(itemNode.getElementsByTagName('PrimaryCategory')[0], 'CategoryID') || '',
          CategoryName: getTextContent(itemNode.getElementsByTagName('PrimaryCategory')[0], 'CategoryName') || '',
        },
        PictureDetails: {
          GalleryURL: getTextContent(itemNode.getElementsByTagName('PictureDetails')[0], 'GalleryURL') || '',
        },
      };
      products.push(product);
    }
  }

  // Get pagination info
  const paginationResult = xmlDoc.getElementsByTagName('PaginationResult')[0];
  const pagination = paginationResult
    ? {
        TotalNumberOfPages: parseInt(getTextContent(paginationResult, 'TotalNumberOfPages') || '1'),
        TotalNumberOfEntries: parseInt(getTextContent(paginationResult, 'TotalNumberOfEntries') || '0'),
        PageNumber: parseInt(getTextContent(paginationResult, 'PageNumber') || '1'),
      }
    : null;

  return {
    products,
    pagination,
    errors: null,
  };
} catch (error: any) {
  return {
    products: [],
    pagination: null,
    errors: [{ shortMessage: 'XML Parse Error', longMessage: error.message }],
  };
}
}

/**
* Sync eBay products/listings to database
*/
export async function syncEbayProducts(
config: EbayConfig,
storeName: string = 'eBay'
): Promise<{ success: boolean; productsSynced: number; error?: string }> {
try {
  // Get token
  const envAuthnAuthToken = process.env.EBAY_AUTHN_AUTH_TOKEN || process.env.OAUTH_TOKEN || process.env.EBAY_USER_TOKEN;
  let oauthToken = envAuthnAuthToken || config.oauthToken;

  if (!oauthToken) {
    try {
      oauthToken = await getCachedEbayToken();
    } catch (error: any) {
      return {
        success: false,
        productsSynced: 0,
        error: `Failed to get eBay token: ${error.message}`,
      };
    }
  }

  if (!oauthToken || oauthToken.trim().length === 0) {
    return {
      success: false,
      productsSynced: 0,
      error: 'eBay token is empty',
    };
  }

  const updatedConfig = { ...config, oauthToken };

  const { isDatabaseAvailable } = await import('../db');
  if (!isDatabaseAvailable()) {
    return {
      success: false,
      productsSynced: 0,
      error: 'Database not configured or unavailable',
    };
  }

  let allProducts: any[] = [];
  let currentPage = 1;
  let hasMorePages = true;
  const maxPages = 100; // Safety limit

  // Use a date 90 days ago as StartTimeFrom (eBay requirement)
  // This will fetch all active listings from the last 90 days
  const startTimeFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  while (hasMorePages && currentPage <= maxPages) {
    console.log(`📄 Fetching eBay products page ${currentPage}...`);

    const response = await makeRawGetSellerListRequest(updatedConfig, currentPage, startTimeFrom);

    if (response.statusCode !== 200) {
      console.error(`❌ eBay API HTTP Error: ${response.statusCode}`);
      break;
    }

    const parsedResult = parseProductsFromXML(response.xml);

    if (parsedResult.errors && parsedResult.errors.length > 0) {
      console.error('❌ eBay API Errors:', parsedResult.errors);
      if (allProducts.length === 0) {
        return {
          success: false,
          productsSynced: 0,
          error: parsedResult.errors.map((e) => e.shortMessage).join(', '),
        };
      }
      break;
    }

    const products = parsedResult.products || [];
    allProducts = allProducts.concat(products);

    console.log(`✅ Fetched ${products.length} products from page ${currentPage}`);

    if (parsedResult.pagination) {
      if (currentPage >= parsedResult.pagination.TotalNumberOfPages || products.length === 0) {
        hasMorePages = false;
      } else {
        currentPage++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } else {
      hasMorePages = false;
    }
  }

  // Save products to database
  // Note: eBay API doesn't provide cost data, so cost will be null
  // The profits API will use fallback logic based on product type
  let syncedCount = 0;
  for (const product of allProducts) {
    try {
      const price = parseFloat(product.CurrentPrice.value) || 0;
      const productType = product.PrimaryCategory.CategoryName || 'Uncategorized';

      const variants = [{
        id: product.ItemID,
        title: product.Title,
        price: price,
        sku: product.SKU || product.ItemID,
        inventory_quantity: product.Quantity - product.QuantitySold,
        available: product.Quantity - product.QuantitySold > 0,
      }];

      await query(
        `INSERT INTO dashboard.products (
          product_id, store_type, store_name, title, description, product_type,
          vendor, tags, variants, cost, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (product_id, store_type, store_name) 
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          variants = EXCLUDED.variants,
          cost = EXCLUDED.cost,
          raw_data = EXCLUDED.raw_data,
          synced_at = CURRENT_TIMESTAMP`,
        [
          product.ItemID,
          'ebay',
          storeName,
          product.Title,
          product.Description || '',
          productType,
          'eBay Seller',
          [],
          JSON.stringify(variants),
          null, // eBay doesn't provide cost via API - can be set manually or use fallback
          JSON.stringify(product),
        ]
      );
      syncedCount++;
    } catch (error: any) {
      console.error(`Error saving product ${product.ItemID}:`, error.message);
    }
  }

  console.log(`✅ Synced ${syncedCount} eBay products to database`);

  return {
    success: true,
    productsSynced: syncedCount,
  };
} catch (error: any) {
  console.error('❌ Error syncing eBay products:', error);
  return {
    success: false,
    productsSynced: 0,
    error: error.message,
  };
}
}

/**
* Sync eBay customers from orders to database
*/
export async function syncEbayCustomers(
storeName: string = 'eBay'
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

  // Get all unique customers from orders
  const result = await query(
    `SELECT DISTINCT
      buyer_username,
      buyer_email,
      shipping_address,
      COUNT(*) as orders_count,
      SUM(total_price) as total_spent
    FROM dashboard.orders
    WHERE store_type = 'ebay' AND store_name = $1
      AND (buyer_username IS NOT NULL OR buyer_email IS NOT NULL)
    GROUP BY buyer_username, buyer_email, shipping_address`,
    [storeName]
  );

  let syncedCount = 0;
  for (const row of result.rows) {
    try {
      const customerId = row.buyer_email || row.buyer_username || `ebay_${Date.now()}`;
      const shippingAddress = row.shipping_address || {};
      const nameParts = (row.buyer_username || '').split(' ');
      const firstName = nameParts[0] || 'eBay';
      const lastName = nameParts.slice(1).join(' ') || 'Buyer';

      await query(
        `INSERT INTO dashboard.customers (
          customer_id, store_type, store_name, first_name, last_name, email,
          orders_count, total_spent, addresses, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (customer_id, store_type, store_name) 
        DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          email = EXCLUDED.email,
          orders_count = EXCLUDED.orders_count,
          total_spent = EXCLUDED.total_spent,
          addresses = EXCLUDED.addresses,
          synced_at = CURRENT_TIMESTAMP`,
        [
          customerId,
          'ebay',
          storeName,
          firstName,
          lastName,
          row.buyer_email || '',
          parseInt(row.orders_count) || 0,
          parseFloat(row.total_spent) || 0,
          JSON.stringify([shippingAddress]),
          JSON.stringify({ buyer_username: row.buyer_username, shipping_address: shippingAddress }),
        ]
      );
      syncedCount++;
    } catch (error: any) {
      console.error(`Error saving customer ${row.buyer_username || row.buyer_email}:`, error.message);
    }
  }

  console.log(`✅ Synced ${syncedCount} eBay customers to database`);

  return {
    success: true,
    customersSynced: syncedCount,
  };
} catch (error: any) {
  console.error('❌ Error syncing eBay customers:', error);
  return {
    success: false,
    customersSynced: 0,
    error: error.message,
  };
}
}