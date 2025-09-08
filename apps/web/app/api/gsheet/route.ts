import { NextRequest, NextResponse } from 'next/server';

function toGoogleCSVUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!u.hostname.includes('docs.google.com')) return null;
    const parts = u.pathname.split('/');
    const idIdx = parts.findIndex((p) => p === 'd');
    const id = idIdx >= 0 ? parts[idIdx + 1] : '';
    if (!id) return null;
    let gid = '';
    if (u.hash.includes('gid=')) gid = u.hash.split('gid=')[1].split(/[&#]/)[0];
    if (!gid && u.searchParams.get('gid')) gid = u.searchParams.get('gid') || '';
    const base = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
    return gid ? `${base}&gid=${gid}` : base;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') || '';
  const csvUrl = toGoogleCSVUrl(u);
  if (!csvUrl) {
    return NextResponse.json({ error: 'Bad Google Sheets URL' }, { status: 400 });
  }

  const res = await fetch(csvUrl, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `Sheets fetch failed (${res.status})`, detail: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const csv = await res.text();
  return new NextResponse(csv, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}