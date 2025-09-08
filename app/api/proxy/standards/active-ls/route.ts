// app/api/proxy/standards/active-ls/route.ts
import { forward } from '../../_lib';

export async function GET(req: Request) {
  return forward(req, '/standards/active/ls', { method: 'GET' });
}