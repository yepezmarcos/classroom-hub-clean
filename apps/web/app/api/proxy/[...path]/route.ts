// web/app/api/proxy/[...path]/route.ts
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Point to Nest API base (with /api prefix)
const API_BASE = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000/api';

function buildTarget(req: NextRequest, pathParts: string[]) {
  // incoming: /api/proxy/<...path>
  const subpath = (pathParts || []).join('/');
  const qs = req.nextUrl.search || '';
  // forward to: http://localhost:4000/api/<...path>?...
  return `${API_BASE}/${subpath}${qs}`;
}

async function proxy(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const url = buildTarget(req, ctx.params.path || []);

  const headers = new Headers();
  // forward useful headers
  const incoming = req.headers;
  if (incoming.get('authorization')) headers.set('authorization', incoming.get('authorization')!);
  if (incoming.get('content-type')) headers.set('content-type', incoming.get('content-type')!);
  if (incoming.get('cookie')) headers.set('cookie', incoming.get('cookie')!);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  // Only pass a body for methods that can have one
  if (!['GET', 'HEAD'].includes(req.method)) {
    const buf = await req.arrayBuffer();
    init.body = buf.byteLength ? buf : undefined;
  }

  const res = await fetch(url, init);

  // Relay response
  const outHeaders = new Headers();
  res.headers.forEach((v, k) => outHeaders.set(k, v));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders });
}

// Export handlers for all common verbs
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };