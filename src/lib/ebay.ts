export interface EbayOrder {
  orderId: string;
  transactionId: string;
  totalPrice: string;
  creationDate: string;
  orderStatus: string;
  buyer: {
    username: string;
    email: string;
  };
  shippingAddress: {
    street1: string;
    city: string;
    stateOrProvince: string;
    countryCode: string;
    postalCode: string;
  };
  lineItems: {
    itemId: string;
    title: string;
    quantity: number;
    price: string;
    sku: string;
  }[];
}

export interface EbayProduct {
  itemId: string;
  title: string;
  description: string;
  categoryId: string;
  sellerInfo: {
    sellerUserName: string;
  };
  listingDetails: {
    currentPrice: string;
    quantityAvailable: number;
    condition: string;
  };
}

export interface EbayBuyer {
  username: string;
  email: string;
  feedbackScore: number;
  registrationDate: string;
  address: {
    street1: string;
    city: string;
    stateOrProvince: string;
    countryCode: string;
    postalCode: string;
  };
}

async function fetchFromEbay(endpoint: string) {
  const url = `/api/ebay?endpoint=${endpoint}`;
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

export async function fetchEbayOrders(): Promise<{ orders: EbayOrder[] } | { error: string }> {
  return fetchFromEbay('orders');
}

export async function fetchEbayProducts(): Promise<{ products: EbayProduct[] } | { error: string }> {
  return fetchFromEbay('products');
}

export async function fetchEbayBuyers(): Promise<{ buyers: EbayBuyer[] } | { error: string }> {
  return fetchFromEbay('buyers');
}

export async function getEbayOrderDetails(orderId: string): Promise<{ order: EbayOrder } | { error: string }> {
  return fetchFromEbay(`orders/${orderId}`);
}

export async function getEbayProductDetails(itemId: string): Promise<{ product: EbayProduct } | { error: string }> {
  return fetchFromEbay(`products/${itemId}`);
}

export async function getEbayBuyerDetails(username: string): Promise<{ buyer: EbayBuyer } | { error: string }> {
  return fetchFromEbay(`buyers/${username}`);
}