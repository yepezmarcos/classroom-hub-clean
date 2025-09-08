import { NextResponse } from 'next/server';
import { prisma } from '../_lib/db';

export async function GET() {
  const items = await prisma.commentTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const b = await req.json();
  const created = await prisma.commentTemplate.create({
    data: { text: b.text, tags: b.tags || [], subject: b.subject || null, gradeBand: b.gradeBand || null, topic: b.topic || null },
  });
  return NextResponse.json(created, { status: 201 });
}