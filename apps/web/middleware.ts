import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // Allow public proxy calls through without forcing auth
  if (p.startsWith('/api/proxy/standards') ||
      p.startsWith('/api/proxy/ai') ||
      p.startsWith('/api/proxy/comments') ||
      p.startsWith('/api/proxy/settings')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}