import { NextResponse } from 'next/server';
import { prisma } from '../_lib/db';

export async function GET() {
  const students = await prisma.student.findMany({
    orderBy: [{ last: 'asc' }, { first: 'asc' }],
    include: {
      links: { include: { guardian: true } },
      enrollments: { include: { classroom: true } },
      notes: { take: 1, orderBy: { createdAt: 'desc' } }, // for updatedAt fallback
    },
  });

  const rows = students.map(s => {
    const primary = s.links[0]?.guardian;
    return {
      id: s.id,
      first: s.first,
      last: s.last,
      grade: s.grade,
      email: s.email,
      gender: s.gender,
      pronouns: s.pronouns,
      iep: s.iep,
      ell: s.ell,
      medical: s.medical,
      updatedAt: s.updatedAt ?? s.createdAt,
      primaryGuardian: primary ? {
        name: primary.name,
        relationship: primary.relationship,
        email: primary.email,
        phone: primary.phone,
      } : null,
      courses: s.enrollments.map(e => e.classroom?.name).filter(Boolean),
    };
  });

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    first, last, grade, email, gender, pronouns, iep, ell, medical,
    guardians = [] as Array<{name:string;email?:string;phone?:string;relationship?:string}>,
  } = body;

  const created = await prisma.student.create({
    data: {
      first, last, grade, email, gender, pronouns, iep, ell, medical,
      links: {
        create: guardians.filter((g: any) => g?.name?.trim()).map((g: any) => ({
          guardian: {
            create: {
              name: g.name,
              email: g.email || null,
              phone: g.phone || null,
              relationship: g.relationship || null,
            }
          }
        }))
      }
    }
  });
  return NextResponse.json(created, { status: 201 });
}