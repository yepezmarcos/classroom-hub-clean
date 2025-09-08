import { NextRequest, NextResponse } from 'next/server';
import { db } from '../_db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = 'a' + (db.assignments.length + 1);
  const created = {
    id,
    name: String(body.name || 'New Assignment'),
    max: Number(body.max) || 10,
    category: body.category ?? null,
    term: body.term ?? null,
    subject: body.subject ?? null,
  };
  db.assignments.push(created);
  return NextResponse.json(created);
}