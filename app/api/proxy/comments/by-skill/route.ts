// app/api/proxy/comments/by-skill/route.ts
import { forward } from '../../_lib';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = `/comments/by-skill${qs ? `?${qs}` : ''}`;
  return forward(req, path, { method: 'GET' });
}