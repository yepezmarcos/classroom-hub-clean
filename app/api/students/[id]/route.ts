import { NextResponse } from 'next/server';
import { prisma } from '../../_lib/db';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      links: { include: { guardian: true } },
      enrollments: { include: { classroom: true } },
      notes: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ...s,
    guardians: undefined, parents: undefined, // normalize to links
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json();
  const updated = await prisma.student.update({
    where: { id: params.id },
    data: {
      first: b.first, last: b.last, grade: b.grade, email: b.email,
      gender: b.gender, pronouns: b.pronouns,
      iep: !!b.iep, ell: !!b.ell, medical: !!b.medical,
    },
  });
  return NextResponse.json(updated);
}