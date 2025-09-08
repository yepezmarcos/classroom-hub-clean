// apps/web/app/lib/api.ts
export async function api(path: string, init?: RequestInit) {
  const base =
    process.env.NEXT_PUBLIC_USE_MOCKS === '1' ? '/api/mock' : '/api/proxy';
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const r = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'Content-Type': 'application/json',
      'X-Tenant-Id': 'default',
    },
  });
  const t = await r.text();
  let d: any;
  try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  if (!r.ok) {
    const msg = (d && (d.message || d.error)) || `HTTP ${r.status}`;
    const e = new Error(msg) as any; (e as any).status = r.status;
    throw e;
  }
  return d;
}