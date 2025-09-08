// apps/web/app/api/hub/[...path]/route.ts
import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function handler(req: NextRequest, { params }: { params: { path?: string[] } }) {
  const path = (params.path || []).join('/');
  const url = `${API_URL}/${path}`;

  const headers = new Headers();
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);

  // If the browser sent Authorization, forward it
  const incomingAuth = req.headers.get('authorization');
  if (incomingAuth) {
    headers.set('authorization', incomingAuth);
  } else {
    // Otherwise, fetch the NextAuth session and attach apiToken
    const sessionRes = await fetch(new URL('/api/auth/session', req.url), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      const apiToken = session?.apiToken || session?.user?.apiToken;
      if (apiToken) headers.set('authorization', `Bearer ${apiToken}`);
    }
  }

  const method = req.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer();

  const upstream = await fetch(url, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete('transfer-encoding');

  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE, handler as OPTIONS };