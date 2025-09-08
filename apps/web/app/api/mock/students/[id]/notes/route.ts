import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // Just pretend we saved it.
  return NextResponse.json({ ok: true, studentId: params.id });
}