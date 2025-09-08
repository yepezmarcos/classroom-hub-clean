import { NextResponse } from 'next/server';

const STUDENTS = [
  { id: 's1', first: 'Ava',   last: 'Nguyen',  grade: '9', email: 'ava@example.com' },
  { id: 's2', first: 'Liam',  last: 'Patel',   grade: '10', email: 'liam@example.com' },
  { id: 's3', first: 'Sofia', last: 'Martins', grade: '9', email: 'sofia@example.com' },
];

export async function GET() {
  return NextResponse.json(STUDENTS);
}