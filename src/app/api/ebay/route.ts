import { EbayBuyer, EbayOrder, EbayProduct } from '@/lib/ebay';
import { NextRequest, NextResponse } from 'next/server';

const EBAY_CONFIG = {
  USERNAME: process.env.EBAY_USERNAME || 'rya.aver',
  PASSWORD: process.env.EBAY_PASSWORD || 'Grove156266!',
  APP_ID: process.env.EBAY_APP_ID || '', // Optional for Trading API
  CERT_ID: process.env.EBAY_CERT_ID || '', // Optional for Trading API
  ENV: process.env.EBAY_ENV || 'sandbox', // 'sandbox' or 'production'
  BASE_URL: process.env.EBAY_ENV === 'production' ? 'https://api.ebay.com/ws/api/v1.1' : 'https://api.sandbox.ebay.com/ws/api/v1.1',
  MARKETPLACE_ID: process.env.EBAY_MARKETPLACE_ID || 'EBAY_US',
  COUNTRY_CODE: process.env.EBAY_COUNTRY_CODE || 'US',
  CURRENCY_CODE: process.env.EBAY_CURRENCY_CODE || 'USD',
};

// Trading API Call Helper
async function makeTradingApiCall(callName: string, request: any): Promise<any> {
  try {
    const url = `${EBAY_CONFIG.BASE_URL}/${callName}`;
    
    const authString = Buffer.from(
      `${EBAY_CONFIG.APP_ID || EBAY_CONFIG.USERNAME}:${EBAY_CONFIG.CERT_ID || EBAY_CONFIG.PASSWORD}`
    ).toString('base64');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': callName,
        'X-EBAY-API-APP-NAME': EBAY_CONFIG.APP_ID || EBAY_CONFIG.USERNAME,
        'X-EBAY-API-DEV-NAME': EBAY_CONFIG.APP_ID || EBAY_CONFIG.USERNAME,
        'X-EBAY-API-CERT-NAME': EBAY_CONFIG.CERT_ID || EBAY_CONFIG.PASSWORD,
        'X-EBAY-API-SITEID': '0', // US site
        'X-EBAY-API-REQUEST-FORMAT': 'SOAP',
        'X-EBAY-API-RESPONSE-FORMAT': 'XML',
        'Content-Type': 'text/xml',
        'Authorization': `Basic ${authString}`,
      },
      body: buildTradingRequestXML(callName, request),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`eBay API Error ${response.status}:`, errorText);
      return {
        success: false,
        error: `API call failed: ${response.status} ${errorText.substring(0, 200)}`
      };
    }

    const xmlResponse = await response.text();
    const parsedData = parseTradingXMLResponse(callName, xmlResponse);
    
    return {
      success: true,
      data: parsedData
    };
  } catch (error) {
    console.error('Trading API Error:', error);
    return {
      success: false,
      error: `Request error: ${(error as Error).message}`
    };
  }
}

// Build XML request for Trading API
function buildTradingRequestXML(callName: string, request: any): string {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <RequesterCredentials xmlns="urn:ebay:apis:eBLBaseComponents">
      <eBayAuthToken></eBayAuthToken>
    </RequesterCredentials>
  </soap:Header>
  <soap:Body>
    <${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">
      ${buildCallBody(callName, request)}
    </${callName}Request>
  </soap:Body>
</soap:Envelope>`;

  return envelope;
}

// Build specific call body
function buildCallBody(callName: string, request: any): string {
  switch (callName) {
    case 'GetMyeBaySelling':
      return `
        <ActiveList>
          <Include>true</Include>
          <Pagination>
            <EntriesPerPage>100</EntriesPerPage>
          </Pagination>
        </ActiveList>
        <SoldList>
          <Include>true</Include>
          <Pagination>
            <EntriesPerPage>100</EntriesPerPage>
          </Pagination>
        </SoldList>
      `;
    case 'GetOrders':
      return `
        <CreateTimeFrom>${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}</CreateTimeFrom>
        <OrderRole>Seller</OrderRole>
        <OrderStatus>Active</OrderStatus>
        <Pagination>
          <EntriesPerPage>100</EntriesPerPage>
        </Pagination>
      `;
    case 'GetItem':
      return `<ItemID>${request.itemId}</ItemID>`;
    case 'GetUser':
      return `<UserID>${request.username}</UserID>`;
    default:
      return '';
  }
}

// Simple XML parsing for Trading API responses
function parseTradingXMLResponse(callName: string, xml: string): any {
  // Simple XML to JSON conversion - in production, use a proper XML parser like xml2js
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const errorNode = doc.querySelector('ErrorMessage');
  
  if (errorNode) {
    const errorCode = errorNode.querySelector('ErrorCode')?.textContent || '';
    const longMessage = errorNode.querySelector('LongMessage')?.textContent || '';
    throw new Error(`eBay API Error ${errorCode}: ${longMessage}`);
  }

  switch (callName) {
    case 'GetMyeBaySelling':
      return parseMyeBaySellingResponse(doc);
    case 'GetOrders':
      return parseGetOrdersResponse(doc);
    case 'GetItem':
      return parseGetItemResponse(doc);
    case 'GetUser':
      return parseGetUserResponse(doc);
    default:
      return { raw: xml };
  }
}

function parseMyeBaySellingResponse(doc: Document): any {
  const activeItems: EbayProduct[] = [];
  const soldItems: EbayOrder[] = [];

  // Parse active items
  const activeItemNodes = doc.querySelectorAll('ItemArray Item');
  activeItemNodes.forEach(itemNode => {
    const itemId = itemNode.querySelector('ItemID')?.textContent || '';
    const title = itemNode.querySelector('Title')?.textContent || '';
    const currentPrice = itemNode.querySelector('CurrentPrice')?.textContent || '0.00';
    const quantityAvailable = parseInt(itemNode.querySelector('QuantityAvailable')?.textContent || '0');
    const condition = itemNode.querySelector('ConditionID')?.textContent || 'New';
    const description = itemNode.querySelector('Description')?.textContent || '';
    const categoryId = itemNode.querySelector('PrimaryCategory CategoryID')?.textContent || '';

    activeItems.push({
      itemId,
      title,
      description,
      categoryId,
      sellerInfo: {
        sellerUserName: EBAY_CONFIG.USERNAME
      },
      listingDetails: {
        currentPrice,
        quantityAvailable,
        condition: condition === '1000' ? 'New' : 'Used'
      }
    });
  });

  // Parse sold items
  const soldItemNodes = doc.querySelectorAll('OrderTransactionArray OrderTransaction');
  soldItemNodes.forEach(transactionNode => {
    const orderId = transactionNode.querySelector('Order OrderID')?.textContent || '';
    const transactionId = transactionNode.querySelector('TransactionID')?.textContent || '';
    const totalPrice = transactionNode.querySelector('Transaction Total')?.textContent || '0.00';
    const creationDate = transactionNode.querySelector('CreatedTime')?.textContent || new Date().toISOString();
    const orderStatus = transactionNode.querySelector('Order OrderStatus')?.textContent || 'completed';
    
    const buyerUsername = transactionNode.querySelector('BuyerUserID')?.textContent || '';
    const buyerEmail = transactionNode.querySelector('BuyerEmail')?.textContent || '';
    
    const shippingAddress = transactionNode.querySelector('ShippingAddress');
    const street1 = shippingAddress?.querySelector('Street1')?.textContent || '';
    const city = shippingAddress?.querySelector('CityName')?.textContent || '';
    const state = shippingAddress?.querySelector('StateOrProvince')?.textContent || '';
    const country = shippingAddress?.querySelector('Country')?.textContent || 'US';
    const postalCode = shippingAddress?.querySelector('PostalCode')?.textContent || '';

    const lineItem = transactionNode.querySelector('Item');
    const itemId = lineItem?.querySelector('ItemID')?.textContent || '';
    const itemTitle = lineItem?.querySelector('Title')?.textContent || '';
    const quantity = parseInt(lineItem?.querySelector('QuantitySold')?.textContent || '1');
    const price = transactionNode.querySelector('Transaction Price')?.textContent || '0.00';
    const sku = lineItem?.querySelector('SKU')?.textContent || '';

    soldItems.push({
      orderId,
      transactionId,
      totalPrice,
      creationDate,
      orderStatus,
      buyer: {
        username: buyerUsername,
        email: buyerEmail
      },
      shippingAddress: {
        street1,
        city,
        stateOrProvince: state,
        countryCode: country,
        postalCode
      },
      lineItems: [{
        itemId,
        title: itemTitle,
        quantity,
        price,
        sku
      }]
    });
  });

  return { activeItems, soldItems };
}

function parseGetOrdersResponse(doc: Document): any {
  const orders: EbayOrder[] = [];
  
  const orderNodes = doc.querySelectorAll('OrderArray Order');
  orderNodes.forEach(orderNode => {
    const orderId = orderNode.querySelector('OrderID')?.textContent || '';
    const totalPrice = orderNode.querySelector('Total')?.textContent || '0.00';
    const creationDate = orderNode.querySelector('CreatedTime')?.textContent || new Date().toISOString();
    const orderStatus = orderNode.querySelector('OrderStatus')?.textContent || 'Active';
    
    const buyerUsername = orderNode.querySelector('BuyerUserID')?.textContent || '';
    const buyerEmail = orderNode.querySelector('BuyerEmail')?.textContent || '';
    
    const shippingAddress = orderNode.querySelector('ShippingAddress');
    const street1 = shippingAddress?.querySelector('Street1')?.textContent || '';
    const city = shippingAddress?.querySelector('CityName')?.textContent || '';
    const state = shippingAddress?.querySelector('StateOrProvince')?.textContent || '';
    const country = shippingAddress?.querySelector('Country')?.textContent || 'US';
    const postalCode = shippingAddress?.querySelector('PostalCode')?.textContent || '';

    const transactionNodes = orderNode.querySelectorAll('TransactionArray Transaction');
    const lineItems: any[] = [];
    
    transactionNodes.forEach(transactionNode => {
      const itemId = transactionNode.querySelector('Item ItemID')?.textContent || '';
      const itemTitle = transactionNode.querySelector('Item Title')?.textContent || '';
      const quantity = parseInt(transactionNode.querySelector('Quantity')?.textContent || '1');
      const price = transactionNode.querySelector('Price')?.textContent || '0.00';
      const sku = transactionNode.querySelector('Item SKU')?.textContent || '';

      lineItems.push({
        itemId,
        title: itemTitle,
        quantity,
        price,
        sku
      });
    });

    orders.push({
      orderId,
      transactionId: orderId, // Use orderId as fallback
      totalPrice,
      creationDate,
      orderStatus,
      buyer: {
        username: buyerUsername,
        email: buyerEmail
      },
      shippingAddress: {
        street1,
        city,
        stateOrProvince: state,
        countryCode: country,
        postalCode
      },
      lineItems
    });
  });

  return { orders };
}

function parseGetItemResponse(doc: Document): EbayProduct {
  const itemNode = doc.querySelector('Item');
  if (!itemNode) {
    throw new Error('Item not found in response');
  }

  const itemId = itemNode.querySelector('ItemID')?.textContent || '';
  const title = itemNode.querySelector('Title')?.textContent || '';
  const description = itemNode.querySelector('Description')?.textContent || '';
  const categoryId = itemNode.querySelector('PrimaryCategory CategoryID')?.textContent || '';
  const currentPrice = itemNode.querySelector('CurrentPrice')?.textContent || '0.00';
  const quantityAvailable = parseInt(itemNode.querySelector('QuantityAvailable')?.textContent || '0');
  const condition = itemNode.querySelector('ConditionID')?.textContent || '1000';

  return {
    itemId,
    title,
    description,
    categoryId,
    sellerInfo: {
      sellerUserName: EBAY_CONFIG.USERNAME
    },
    listingDetails: {
      currentPrice,
      quantityAvailable,
      condition: condition === '1000' ? 'New' : 'Used'
    }
  };
}

function parseGetUserResponse(doc: Document): EbayBuyer {
  const userNode = doc.querySelector('User');
  if (!userNode) {
    throw new Error('User not found in response');
  }

  const username = userNode.querySelector('UserID')?.textContent || '';
  const email = userNode.querySelector('Email')?.textContent || '';
  const feedbackScore = parseInt(userNode.querySelector('FeedbackScore')?.textContent || '0');
  const registrationDate = userNode.querySelector('RegistrationDate')?.textContent || new Date().toISOString();
  
  const addressNode = userNode.querySelector('Address');
  const street1 = addressNode?.querySelector('Street1')?.textContent || '';
  const city = addressNode?.querySelector('CityName')?.textContent || '';
  const state = addressNode?.querySelector('StateOrProvince')?.textContent || '';
  const country = addressNode?.querySelector('Country')?.textContent || 'US';
  const postalCode = addressNode?.querySelector('PostalCode')?.textContent || '';

  return {
    username,
    email,
    feedbackScore,
    registrationDate,
    address: {
      street1,
      city,
      stateOrProvince: state,
      countryCode: country,
      postalCode
    }
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  try {
    console.log(`Making eBay API call: ${endpoint}`);
    
    if (endpoint === 'orders') {
      const apiResult = await makeTradingApiCall('GetOrders', {});
      if (!apiResult.success) {
        return NextResponse.json({ error: apiResult.error }, { status: 500 });
      }
      return NextResponse.json({ orders: apiResult.data.orders || [] });
    }
    
    if (endpoint === 'products') {
      const apiResult = await makeTradingApiCall('GetMyeBaySelling', {});
      if (!apiResult.success) {
        return NextResponse.json({ error: apiResult.error }, { status: 500 });
      }
      return NextResponse.json({ products: apiResult.data.activeItems || [] });
    }
    
    if (endpoint === 'buyers') {
      // For buyers, we'll get recent buyers from orders
      const ordersResult = await makeTradingApiCall('GetOrders', {});
      if (!ordersResult.success) {
        return NextResponse.json({ error: ordersResult.error }, { status: 500 });
      }
      
      const orders = ordersResult.data.orders || [];
      const uniqueBuyers = new Map<string, EbayBuyer>();
      
      orders.forEach((order: EbayOrder) => {
        if (!uniqueBuyers.has(order.buyer.username)) {
          uniqueBuyers.set(order.buyer.username, {
            username: order.buyer.username,
            email: order.buyer.email,
            feedbackScore: 0, // Would need separate API call to get feedback
            registrationDate: new Date().toISOString(),
            address: order.shippingAddress
          });
        }
      });
      
      return NextResponse.json({ buyers: Array.from(uniqueBuyers.values()) });
    }
    
    if (endpoint.startsWith('orders/')) {
      const orderId = endpoint.split('/')[1];
      // For individual order, use GetOrder API
      const apiResult = await makeTradingApiCall('GetOrders', { orderId });
      if (!apiResult.success) {
        return NextResponse.json({ error: apiResult.error }, { status: 500 });
      }
      
      const orders = apiResult.data.orders || [];
      const order = orders.find((o: EbayOrder) => o.orderId === orderId);
      
      return order 
        ? NextResponse.json({ order })
        : NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    if (endpoint.startsWith('products/')) {
      const itemId = endpoint.split('/')[1];
      const apiResult = await makeTradingApiCall('GetItem', { itemId });
      if (!apiResult.success) {
        return NextResponse.json({ error: apiResult.error }, { status: 500 });
      }
      return NextResponse.json({ product: apiResult.data });
    }
    
    if (endpoint.startsWith('buyers/')) {
      const username = endpoint.split('/')[1];
      const apiResult = await makeTradingApiCall('GetUser', { username });
      if (!apiResult.success) {
        return NextResponse.json({ error: apiResult.error }, { status: 500 });
      }
      return NextResponse.json({ buyer: apiResult.data });
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    
  } catch (error: any) {
    console.error('eBay API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}