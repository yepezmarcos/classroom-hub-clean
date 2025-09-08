/* apps/web/pages/api/proxy/[...path].ts */
import type { NextApiRequest, NextApiResponse } from 'next';
export const config = { api: { bodyParser: false } };

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000').replace(/\/+$/, '');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = (req.query.path as string[] | undefined)?.join('/') || '';
  const qs = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetUrl = `${API_BASE}/${path}${qs}`;

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => {
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', resolve);
  });
  const hasBody = !['GET','HEAD'].includes((req.method || 'GET').toUpperCase());
  const body = hasBody ? Buffer.concat(chunks) : undefined;

  const headers = new Headers();
  Object.entries(req.headers).forEach(([k, v]) => {
    if (v == null) return;
    headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  });
  headers.delete('host'); headers.delete('connection'); headers.delete('transfer-encoding');

  const upstream = await fetch(targetUrl, { method: req.method, headers, body });
  res.status(upstream.status);
  upstream.headers.forEach((v, k) => {
    if (!['content-encoding','transfer-encoding'].includes(k.toLowerCase())) res.setHeader(k, v);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}