import { NextRequest, NextResponse } from 'next/server';

const STUDENTS: any[] = [
  {
    id: 's1', first: 'Ava', last: 'Nguyen', grade: '9', gender: 'female',
    pronouns: 'she/her/her', email: 'ava@example.com',
    enrollments: [{ classroom: { id: 'c1', name: 'Math 9' } }],
    notes: [],
    parents: [{ name: 'Trang Nguyen', email: 'parent1@example.com', relationship: 'Mother' }],
  },
  {
    id: 's2', first: 'Liam', last: 'Patel', grade: '10', gender: 'male',
    pronouns: 'he/him/his', email: 'liam@example.com',
    enrollments: [{ classroom: { id: 'c1', name: 'Math 9' } }],
    notes: [],
    parents: [{ name: 'Rakesh Patel', email: 'parent2@example.com', relationship: 'Father' }],
  },
  {
    id: 's3', first: 'Sofia', last: 'Martins', grade: '9', gender: 'female',
    pronouns: 'she/her/her', email: 'sofia@example.com',
    enrollments: [{ classroom: { id: 'c1', name: 'Math 9' } }],
    notes: [],
    parents: [{ name: 'Ana Martins', email: 'parent3@example.com', relationship: 'Mother' }],
  },
];

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const s = STUDENTS.find(x => x.id === ctx.params.id);
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(s);
}

/** minimal patch for edits from the profile page */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const idx = STUDENTS.findIndex(x => x.id === ctx.params.id);
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  STUDENTS[idx] = { ...STUDENTS[idx], ...body };
  return NextResponse.json(STUDENTS[idx]);
}