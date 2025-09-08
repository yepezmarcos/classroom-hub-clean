import { NextResponse } from 'next/server';

export async function GET(
    _req: Request,
    { params }: { params: { token: string } }
) {
    // Super simple token gate for local dev
    const { token } = params;
    const ok = token && token.length >= 4;

    if (!ok) {
        return NextResponse.json({ message: 'Invalid token' }, { status: 404 });
    }

    // Fake payload (stable enough for UI work)
    const now = Date.now();
    const notes = Array.from({ length: 6 }).map((_, i) => ({
        id: `n${i}`,
        body: i % 2
            ? 'Student participated actively in group discussion.'
            : 'Reminder: bring completed reading log tomorrow.',
        tags: i % 2 ? ['subject:ELA'] : ['subject:GENERAL'],
        createdAt: new Date(now - i * 36e5).toISOString(),
        author: { name: 'Ms. Rivera', email: 'mrivera@example.edu' },
    }));

    const comments = [
        { id: 'c1', text: 'Great effort on the last writing piece! Keep it up.', createdAt: new Date(now - 86e5).toISOString(), author: 'Ms. Rivera', topic: 'Positive' },
        { id: 'c2', text: 'Missing two homework assignments; please check the folder.', createdAt: new Date(now - 172e5).toISOString(), author: 'Ms. Rivera', topic: 'Concern' },
    ];

    const payload = {
        student: { id: 'stu_tok', name: 'Jordan Carter', grade: '5', classroom: '5B' },
        attendance: { present: 132, absent: 4, late: 3, daysTotal: 139 },
        behavior: { positive: 9, neutral: 3, concern: 2 },
        notes,
        comments,
    };

    return NextResponse.json(payload);
}