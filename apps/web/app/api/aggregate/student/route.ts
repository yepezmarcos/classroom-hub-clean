import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId');
  const classroomId = url.searchParams.get('classroomId') || '';
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 });

  // Pull the same gradebook data the page uses (proxy or mock will handle it)
  const gbRes = await fetch(`${url.origin}/api/mock/gradebook`, { cache: 'no-store' });
  const gb = await gbRes.json();

  const assignments = gb.assignments as Array<{ id: string; max: number; subject?: string|null; category?: string|null; term?: string|null }>;
  const grades = gb.grades as Array<{ assignmentId: string; studentId: string; score: number | null }>;

  const mine = grades.filter(g => g.studentId === studentId);
  let got = 0, max = 0;
  const byCategory: Record<string, { got: number; max: number }> = {};
  const bySubject: Record<string, { got: number; max: number }> = {};

  for (const a of assignments) {
    const g = mine.find(x => x.assignmentId === a.id);
    if (!a?.max) continue;
    if (g?.score != null) got += g.score;
    max += a.max;

    const cat = (a.category || 'Uncategorized').trim();
    const sub = (a.subject || '—').trim();

    if (!byCategory[cat]) byCategory[cat] = { got: 0, max: 0 };
    if (!bySubject[sub]) bySubject[sub] = { got: 0, max: 0 };

    if (g?.score != null) {
      byCategory[cat].got += g.score;
      bySubject[sub].got += g.score;
    }
    byCategory[cat].max += a.max;
    bySubject[sub].max += a.max;
  }

  const pct = max > 0 ? Math.round((got / max) * 1000) / 10 : null;

  return NextResponse.json({
    studentId,
    classroomId,
    got,
    max,
    pct,
    byCategory,
    bySubject,
  });
}