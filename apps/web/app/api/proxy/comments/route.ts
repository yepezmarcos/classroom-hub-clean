import { NextRequest } from 'next/server';
import { forward } from '../_lib';

export function GET(req: NextRequest) {
  // → GET http://localhost:4000/api/comments?level=G&q=...
  return forward(req, '/comments');
}

export function POST(req: NextRequest) {
  // → POST http://localhost:4000/api/comments
  return forward(req, '/comments', { method: 'POST' });
}