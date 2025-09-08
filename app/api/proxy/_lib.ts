// app/api/proxy/_lib.ts
export const API_BASE =
  process.env.API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api';

export async function forward(
  req: Request,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const target = `${API_BASE}${path}`;
  const r = await fetch(target, {
    // Don’t cache proxy calls
    cache: 'no-store',
    // copy method/headers/body when applicable
    method: init?.method ?? req.method,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers as Record<string, string>),
    },
    body:
      init?.body ??
      (req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined),
  });

  // Pipe through status & JSON (or text)
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await r.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  }
  const text = await r.text().catch(() => '');
  return new Response(text, { status: r.status });
}