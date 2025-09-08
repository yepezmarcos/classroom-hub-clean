import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // accepts { jurisdiction: string }
  const _ = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true });
}