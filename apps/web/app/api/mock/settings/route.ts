import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    jurisdiction: 'ontario',
    board: 'ontario',
    terms: 3,
    // <- this powers the Gradebook subject chips and the Add Assignment "Subject" select
    subjects: ['Math', 'Science', 'English', 'History'],
    gradeBands: ['9','10','11','12'],
    lsCategories: [
      { id: 'responsibility', label: 'Responsibility' },
      { id: 'organization', label: 'Organization' },
      { id: 'independent-work', label: 'Independent Work' },
      { id: 'collaboration', label: 'Collaboration' },
      { id: 'initiative', label: 'Initiative' },
      { id: 'self-regulation', label: 'Self-Regulation' },
    ],
  });
}