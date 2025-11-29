import { NextRequest, NextResponse } from 'next/server';

// Store domain mapping - handle variations
const tokenMap: Record<string, string> = {
  'revarcine.com': process.env.REVAR_ACCESS_TOKEN!,
  'revar.com': process.env.REVAR_ACCESS_TOKEN!, // Handle revar.com -> revarcine.com
  'meikeusa.com': process.env.MEIKE_ACCESS_TOKEN!,
  'zeaponusa.com': process.env.ZEAPON_ACCESS_TOKEN!,
};

// Map store domains to actual Shopify domains
const domainMap: Record<string, string> = {
  'revar.com': 'revarcine.com',
  'revarcine.com': 'revarcine.com',
  'meikeusa.com': 'meikeusa.com',
  'zeaponusa.com': 'zeaponusa.com',
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const store = searchParams.get('store');
  const endpoint = searchParams.get('endpoint');

  if (!store || !endpoint) {
    return NextResponse.json({ error: 'Missing store or endpoint' }, { status: 400 });
  }

  // Map store domain to actual domain
  const actualDomain = domainMap[store] || store;
  const token = tokenMap[store] || tokenMap[actualDomain];
  
  if (!token) {
    return NextResponse.json({ error: `Invalid store: ${store}. Available stores: ${Object.keys(tokenMap).join(', ')}` }, { status: 400 });
  }

  const url = `https://${actualDomain}/admin/api/2024-07/${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: res.statusText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}