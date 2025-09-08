// app/api/proxy/comments/route.ts
import { NextResponse } from 'next/server';
import { forward } from '../_lib';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const level = url.searchParams.get('level') || '';
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (level) qs.set('level', level);
  const path = `/comments${qs.toString() ? `?${qs.toString()}` : ''}`;
  return forward(req, path, { method: 'GET' });
}

export async function POST(req: Request) {
  // Expecting: { text, skill, level, subject?, gradeBand?, tags? }
  const body = await req.text();
  return forward(req, '/comments', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
}