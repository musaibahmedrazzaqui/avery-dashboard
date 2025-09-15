import { NextRequest, NextResponse } from 'next/server';

const tokenMap: Record<string, string> = {
  'revarcine.com': process.env.REVAR_ACCESS_TOKEN!,
  'meikeusa.com': process.env.MEIKE_ACCESS_TOKEN!,
  'zeaponusa.com': process.env.ZEAPON_ACCESS_TOKEN!,
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const store = searchParams.get('store');
  const endpoint = searchParams.get('endpoint');

  if (!store || !endpoint) {
    return NextResponse.json({ error: 'Missing store or endpoint' }, { status: 400 });
  }

  const token = tokenMap[store];
  if (!token) {
    return NextResponse.json({ error: 'Invalid store' }, { status: 400 });
  }

  const url = `https://${store}/admin/api/2024-07/${endpoint}`;
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