import { NextRequest, NextResponse } from 'next/server';

const CLASSROOM = { id: 'c1', name: 'Math 9 – Period 2', code: 'MTH9-P2', subject: 'Math' };
const STUDENTS = [
  { id: 's1', first: 'Ava',   last: 'Nguyen',  grade: '9' },
  { id: 's2', first: 'Liam',  last: 'Patel',   grade: '10' },
  { id: 's3', first: 'Sofia', last: 'Martins', grade: '9'  },
];
const ASSIGNMENTS = [
  { id: 'a1', name: 'Quiz 1',    max: 10, category: 'Quiz',  term: 'T1', subject: 'Math' },
  { id: 'a2', name: 'Unit Test', max: 40, category: 'Test',  term: 'T1', subject: 'Math' },
  { id: 'a3', name: 'Homework',  max: 20, category: 'Homework', term: 'T1', subject: 'Math' },
];
const GRADES = [
  { studentId: 's1', assignmentId: 'a1', score: 9 },
  { studentId: 's1', assignmentId: 'a2', score: 33 },
  { studentId: 's1', assignmentId: 'a3', score: 18 },
  { studentId: 's2', assignmentId: 'a1', score: 8 },
  { studentId: 's2', assignmentId: 'a2', score: 28 },
  { studentId: 's2', assignmentId: 'a3', score: null }, // missing
  { studentId: 's3', assignmentId: 'a1', score: 7 },
  { studentId: 's3', assignmentId: 'a2', score: 25 },
  { studentId: 's3', assignmentId: 'a3', score: 17 },
];

export async function GET(req: NextRequest) {
  // keep query param for compatibility, but we return a single class either way
  const classroomId = new URL(req.url).searchParams.get('classroomId') || 'c1';
  return NextResponse.json({
    classroom: { ...CLASSROOM, id: classroomId },
    students: STUDENTS,
    assignments: ASSIGNMENTS,
    grades: GRADES,
    tenantId: 'default',
  });
}

/** minimal create for “Add Assignment” */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = `a${Date.now()}`;
  const a = { id, name: body.name || 'Assignment', max: Number(body.max)||10,
              category: body.category || null, term: body.term || null, subject: body.subject || null };
  ASSIGNMENTS.push(a);
  return NextResponse.json(a);
}