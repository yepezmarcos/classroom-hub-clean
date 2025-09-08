// Not persisted. Restarting dev server resets data.
export type Student = { id: string; first: string; last: string; grade?: string|null };
export type Assignment = { id: string; name: string; max: number; category?: string|null; term?: string|null; subject?: string|null };
export type Grade = { assignmentId: string; studentId: string; score: number | null };

const classroomId = '0b597973-26c0-4343-80f7-dda215b74b2a';

const students: Student[] = [
  { id: 's1', first: 'Alex', last: 'Diaz', grade: '9' },
  { id: 's2', first: 'Brianna', last: 'Nguyen', grade: '9' },
  { id: 's3', first: 'Chris', last: 'Patel', grade: '9' },
];

const assignments: Assignment[] = [
  { id: 'a1', name: 'Quiz 1', max: 20, category: 'Quiz', term: 'T1', subject: 'Math' },
  { id: 'a2', name: 'Homework 1', max: 10, category: 'Homework', term: 'T1', subject: 'Math' },
  { id: 'a3', name: 'Unit Test', max: 50, category: 'Test', term: 'T1', subject: 'Math' },
];

const grades: Grade[] = [
  { assignmentId: 'a1', studentId: 's1', score: 18 },
  { assignmentId: 'a1', studentId: 's2', score: 15 },
  { assignmentId: 'a1', studentId: 's3', score: 12 },
  { assignmentId: 'a2', studentId: 's1', score: 10 },
  { assignmentId: 'a2', studentId: 's2', score: 8 },
  { assignmentId: 'a3', studentId: 's1', score: 46 },
];

export const db = {
  classroomId,
  classroom: { id: classroomId, name: 'Algebra I', code: 'ALG1-01', subject: 'Math' },
  students,
  assignments,
  grades,
  settings: {
    subjects: ['Math', 'Science', 'English', 'History'],
    terms: ['T1', 'T2', 'T3'],
    board: 'Ontario',
  },
};