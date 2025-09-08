import type { NextRequest } from 'next/server';

const BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE ||
  'http://localhost:4000/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// DELETE /api/proxy/comments/:id  ->  DELETE {BASE}/comments/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const url = `${BASE}/comments/${encodeURIComponent(id)}`;

  const r = await fetch(url, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
  });

  // Some backends return 204 with no body; normalize that for the client.
  const text = await r.text();
  return new Response(text || JSON.stringify({ ok: r.ok }), {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') || 'application/json',
    },
  });
}