import { NextRequest, NextResponse } from 'next/server';
import { db } from '../_db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { assignmentId, studentId, score } = await req.json();
  const idx = db.grades.findIndex(g => g.assignmentId === assignmentId && g.studentId === studentId);
  if (idx >= 0) db.grades[idx].score = (score === null ? null : Number(score));
  else db.grades.push({ assignmentId, studentId, score: (score === null ? null : Number(score)) });
  return NextResponse.json({ ok: true });
}