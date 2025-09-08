import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tenant = req.headers.get('x-tenant-id') || 'default';

  const upstream = 'http://localhost:4000/grades';
  const r = await fetch(upstream, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenant },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await r.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: r.status });
  } catch {
    return new NextResponse(text || 'Upstream error', { status: r.status });
  }
}