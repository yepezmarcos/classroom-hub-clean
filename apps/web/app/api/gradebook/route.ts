import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get('classroomId') || '';
  const tenant = req.headers.get('x-tenant-id') || 'default';

  const upstream = `http://localhost:4000/gradebook?classroomId=${encodeURIComponent(classroomId)}`;
  const r = await fetch(upstream, {
    method: 'GET',
    headers: { 'X-Tenant-Id': tenant },
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