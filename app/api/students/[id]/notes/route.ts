import { NextResponse } from 'next/server';
import { prisma } from '../../../_lib/db';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { body, tags, authorName, authorEmail } = await req.json();
  if (!body || !Array.isArray(tags)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const note = await prisma.note.create({
    data: {
      studentId: params.id, body, tags, authorName: authorName || null, authorEmail: authorEmail || null,
    },
  });
  return NextResponse.json(note, { status: 201 });
}