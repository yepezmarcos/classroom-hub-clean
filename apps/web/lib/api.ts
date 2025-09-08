type ApiInit = RequestInit & { json?: any };

function toPath(p: string) {
  return p.startsWith('/') ? p : `/${p}`;
}

export async function api(path: string, init?: ApiInit) {
  const url = `/api/proxy${toPath(path)}`;
  const headers = new Headers(init?.headers || {});
  const opts: RequestInit = { method: init?.method || 'GET', headers, cache: 'no-store' };

  if (init?.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    opts.body = JSON.stringify(init.json);
  } else if (init?.body !== undefined) {
    opts.body = init.body as any;
  }

  let res: Response;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    // Network failure -> try mock if enabled
    if (process.env.NEXT_PUBLIC_USE_MOCKS === '1') {
      return apiMock(path, opts);
    }
    throw e;
  }

  if (res.ok) {
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  // If upstream down or we explicitly want mocks
  if (res.status === 502 || process.env.NEXT_PUBLIC_USE_MOCKS === '1') {
    return apiMock(path, opts);
  }

  throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
}

async function apiMock(path: string, opts: RequestInit) {
  const mockUrl = `/api/mock${toPath(path)}`;
  const r = await fetch(mockUrl, { ...opts, cache: 'no-store' });
  if (!r.ok) throw new Error(`Mock failed ${r.status} ${r.statusText}`);
  const ct = r.headers.get('content-type') || '';
  return ct.includes('application/json') ? r.json() : r.text();
}