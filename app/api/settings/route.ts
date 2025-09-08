import { NextResponse } from 'next/server';
import { prisma } from '../_lib/db';

export async function GET() {
  const s = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  if (!s) {
    // sensible defaults (Ontario-like)
    const created = await prisma.settings.create({
      data: {
        id: 'singleton',
        jurisdiction: 'ontario',
        terms: 3,
        subjects: ['Language','Math','Science','Social Studies'],
        gradeBands: ['K-3','4-6','7-8'],
        lsCategories: [
          { id:'responsibility', label:'Responsibility' },
          { id:'organization', label:'Organization' },
          { id:'independent-work', label:'Independent Work' },
          { id:'collaboration', label:'Collaboration' },
          { id:'initiative', label:'Initiative' },
          { id:'self-regulation', label:'Self-Regulation' },
        ],
      } as any,
    });
    return NextResponse.json(created);
  }
  return NextResponse.json(s);
}

// (Optional) allow PUT to update settings
export async function PUT(req: Request) {
  const body = await req.json();
  const s = await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: body,
    create: { id: 'singleton', ...body },
  });
  return NextResponse.json(s);
}