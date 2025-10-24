import { EbayBuyer, EbayOrder, EbayProduct, fetchEbayBuyers, fetchEbayOrders, fetchEbayProducts } from "./ebay";

export interface Order {
  id: number;
  order_number: string;
  total_price: string;
  created_at: string;
  fulfillment_status: string | null;
  financial_status: string;
  line_items: {
    id: number;
    title: string;
    quantity: number;
    price: string;
  }[];
  customer: { first_name: string; last_name: string; email: string } | null;
  shipping_address: { address1: string; city: string; country: string; zip: string } | null;
  tags: string[];
}

export interface Product {
  id: number;
  title: string;
  body_html: string;
  product_type: string;
  vendor: string;
  tags: string[];
  variants: {
    id: number;
    inventory_quantity: number;
    price: string;
    sku: string;
  }[];
}

export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  orders_count: number;
  total_spent: string;
  tags: string[];
  addresses: {
    address1: string;
    city: string;
    country: string;
    zip: string;
  }[];
}

async function fetchFromShopify(store: string, endpoint: string) {
  const url = `/api/shopify?store=${store}&endpoint=${endpoint}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return { error: res.statusText };
    }
    return res.json();
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function fetchOrders(store: string): Promise<{ orders: Order[] } | { error: string }> {
  return fetchFromShopify(store, 'orders.json?status=any&limit=250');
}

export async function fetchProducts(store: string): Promise<{ products: Product[] } | { error: string }> {
  return fetchFromShopify(store, 'products.json?limit=250');
}

export async function fetchCustomers(store: string): Promise<{ customers: Customer[] } | { error: string }> {
  return fetchFromShopify(store, 'customers.json?limit=250');
}

export async function getOrderDetails(store: string, orderId: number): Promise<{ order: Order } | { error: string }> {
  return fetchFromShopify(store, `orders/${orderId}.json`);
}

export async function getProductDetails(store: string, productId: number): Promise<{ product: Product } | { error: string }> {
  return fetchFromShopify(store, `products/${productId}.json`);
}

export async function getCustomerDetails(store: string, customerId: number): Promise<{ customer: Customer } | { error: string }> {
  return fetchFromShopify(store, `customers/${customerId}.json`);
}

export const stores = [
  { name: 'All', domain: 'all' },
  { name: 'RevarCine', domain: 'revarcine.com' },
  { name: 'MeikeUSA', domain: 'meikeusa.com' },
  { name: 'ZeaponUSA', domain: 'zeaponusa.com' },
  { name: 'eBay', domain: 'ebay' }, // Add eBay
] as const;

// Update the aggregate function to include eBay
export async function getAggregateData() {
  const allOrders: (Order & { store: string })[] = [];
  const allProducts: (Product & { store: string })[] = [];
  const allCustomers: (Customer & { store: string })[] = [];
  const errors: { store: string; message: string }[] = [];

  // Shopify stores
  for (const store of stores.slice(1, -1)) { // Exclude eBay for now
    const ordersData = await fetchOrders(store.domain);
    const productsData = await fetchProducts(store.domain);
    const customersData = await fetchCustomers(store.domain);

    if ('error' in ordersData) {
      errors.push({ store: store.name, message: `Orders error: ${ordersData.error}` });
    } else if (ordersData.orders) {
      allOrders.push(...ordersData.orders.map(o => ({ ...o, store: store.name })));
    }

    if ('error' in productsData) {
      errors.push({ store: store.name, message: `Products error: ${productsData.error}` });
    } else if (productsData.products) {
      allProducts.push(...productsData.products.map(p => ({ ...p, store: store.name })));
    }

    if ('error' in customersData) {
      errors.push({ store: store.name, message: `Customers error: ${customersData.error}` });
    } else if (customersData.customers) {
      allCustomers.push(...customersData.customers.map(c => ({ ...c, store: store.name })));
    }
  }

  // eBay data
  try {
    const ebayOrdersData = await fetchEbayOrders();
    const ebayProductsData = await fetchEbayProducts();
    const ebayBuyersData = await fetchEbayBuyers();

    if ('error' in ebayOrdersData) {
      errors.push({ store: 'eBay', message: `Orders error: ${ebayOrdersData.error}` });
    } else if (ebayOrdersData.orders) {
      // Convert eBay orders to Shopify-like format
      const convertedOrders = ebayOrdersData.orders.map((o: EbayOrder) => ({
        id: parseInt(o.orderId),
        order_number: o.orderId,
        total_price: o.totalPrice,
        created_at: o.creationDate,
        fulfillment_status: o.orderStatus === 'completed' ? 'fulfilled' : o.orderStatus === 'shipped' ? 'fulfilled' : 'pending',
        financial_status: o.orderStatus === 'paid' ? 'paid' : 'pending',
        line_items: o.lineItems.map((item: any) => ({
          id: parseInt(item.itemId),
          title: item.title,
          quantity: item.quantity,
          price: item.price,
        })),
        customer: {
          first_name: o.buyer.username.split('.')[0] || 'eBay',
          last_name: o.buyer.username.split('.')[1] || 'Buyer',
          email: o.buyer.email,
        },
        shipping_address: {
          address1: o.shippingAddress.street1,
          city: o.shippingAddress.city,
          country: o.shippingAddress.countryCode,
          zip: o.shippingAddress.postalCode,
        },
        tags: [],
        store: 'eBay',
      }));
      allOrders.push(...convertedOrders);
    }

    if ('error' in ebayProductsData) {
      errors.push({ store: 'eBay', message: `Products error: ${ebayProductsData.error}` });
    } else if (ebayProductsData.products) {
      // Convert eBay products to Shopify-like format
      const convertedProducts = ebayProductsData.products.map((p: EbayProduct) => ({
        id: parseInt(p.itemId),
        title: p.title,
        body_html: p.description,
        product_type: p.categoryId,
        vendor: p.sellerInfo.sellerUserName,
        tags: [],
        variants: [{
          id: parseInt(p.itemId),
          inventory_quantity: p.listingDetails.quantityAvailable,
          price: p.listingDetails.currentPrice,
          sku: p.itemId,
        }],
        store: 'eBay',
      }));
      allProducts.push(...convertedProducts);
    }

    if ('error' in ebayBuyersData) {
      errors.push({ store: 'eBay', message: `Buyers error: ${ebayBuyersData.error}` });
    } else if (ebayBuyersData.buyers) {
      // Convert eBay buyers to Shopify-like format
      const convertedBuyers = ebayBuyersData.buyers.map((b: EbayBuyer) => ({
        id: parseInt(b.username.replace(/\D/g, '')),
        first_name: b.username.split('.')[0] || 'eBay',
        last_name: b.username.split('.')[1] || 'Buyer',
        email: b.email,
        orders_count: 0, // Would need separate API call to get order count
        total_spent: '0.00',
        tags: [],
        addresses: [{
          address1: b.address.street1,
          city: b.address.city,
          country: b.address.countryCode,
          zip: b.address.postalCode,
        }],
        store: 'eBay',
      }));
      allCustomers.push(...convertedBuyers);
    }
  } catch (error) {
    errors.push({ store: 'eBay', message: `Connection error: ${(error as Error).message}` });
  }

  // Rest of your existing aggregation logic remains the same
  const totalRevenue = allOrders.reduce((sum, o) => sum + parseFloat(o.total_price), 0).toFixed(2);
  const activeOrders = allOrders.filter(o => o.fulfillment_status !== 'fulfilled').length;
  const totalCustomers = allCustomers.length;
  const lowStockCount = allProducts.filter(p => p.variants.some(v => v.inventory_quantity < 10)).length;
  const inventoryHealth = allProducts.length > 0 ? Math.round((allProducts.filter(p => p.variants.some(v => v.inventory_quantity > 0)).length / allProducts.length) * 100) : 0;

  const productSales = new Map<string, { units: number; revenue: number; store: string }>();
  allOrders.forEach(o => {
    o.line_items.forEach(item => {
      const key = `${item.title}-${o.store}`;
      const current = productSales.get(key) || { units: 0, revenue: 0, store: o.store };
      current.units += item.quantity;
      current.revenue += item.quantity * parseFloat(item.price);
      productSales.set(key, current);
    });
  });
  const topProducts = Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const customerLifetime = new Map<string, { name: string; email: string; total: number; orders: number; store: string }>();
  allCustomers.forEach(c => {
    const key = `${c.id}-${c.store}`;
    customerLifetime.set(key, {
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
      total: parseFloat(c.total_spent),
      orders: c.orders_count,
      store: c.store,
    });
  });
  const topCustomers = Array.from(customerLifetime.values()).sort((a, b) => b.total - a.total).slice(0, 10);

  const revenueData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dailyRevenue = allOrders.filter(o => o.created_at.startsWith(dateStr)).reduce((sum, o) => sum + parseFloat(o.total_price), 0);
    revenueData.push({ date: dateStr, revenue: dailyRevenue });
  }

  const fulfillmentStatus = allOrders.reduce((acc, o) => {
    const status = o.fulfillment_status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const financialStatus = allOrders.reduce((acc, o) => {
    acc[o.financial_status] = (acc[o.financial_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalRevenue,
    activeOrders,
    inventoryHealth,
    totalCustomers,
    lowStockCount,
    allOrders,
    allProducts,
    allCustomers,
    topProducts,
    topCustomers,
    revenueData,
    fulfillmentStatus: Object.entries(fulfillmentStatus).map(([name, value]) => ({ name, value })),
    financialStatus: Object.entries(financialStatus).map(([name, value]) => ({ name, value })),
    errors,
  };
}