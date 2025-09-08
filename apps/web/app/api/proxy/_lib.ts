// Simple pass-through to the Nest API at http://localhost:4000/api
import { NextRequest, NextResponse } from 'next/server';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE ||
  'http://localhost:4000/api';

export async function forward(req: NextRequest, path: string, init?: RequestInit) {
  const qs = req.nextUrl.searchParams.toString();
  const target = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;

  const res = await fetch(target, {
    method: init?.method || req.method,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers as any),
    },
    body:
      init?.body ??
      (req.method !== 'GET' && req.method !== 'HEAD'
        ? await req.text()
        : undefined),
    cache: 'no-store',
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type':
        res.headers.get('content-type') || 'application/json',
    },
  });
}