// app/api/proxy/standards/seed-learning-skills/route.ts
import { forward } from '../../../_lib';

export async function POST(req: Request) {
  return forward(req, '/standards/seed-learning-skills', { method: 'POST' });
}