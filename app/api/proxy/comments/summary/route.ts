// app/api/proxy/comments/summary/route.ts
import { forward } from '../../_lib';

export async function GET(req: Request) {
  return forward(req, '/comments/summary', { method: 'GET' });
}