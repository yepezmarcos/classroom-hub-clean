import { NextResponse } from 'next/server';

function pick<T>(arr: T[]) { return arr[Math.floor(Math.random()*arr.length)]; }

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0,10);

    const classes = [
        { id: 'c-ela-5b', name: 'ELA • 5B' },
        { id: 'c-math-5b', name: 'Math • 5B' },
        { id: 'c-sci-5b', name: 'Science • 5B' },
        { id: 'c-hist-5b', name: 'History • 5B' },
    ];
    const students = [
        'Jordan Carter', 'Maya Singh', 'Liam Chen', 'Ava Garcia', 'Ethan Patel',
        'Noah Johnson', 'Olivia Brown', 'Emma Davis', 'Sophia Wilson', 'Lucas Lee',
    ];

    // Class rollups
    const byClass = classes.map(c => {
        const present = 24 + Math.floor(Math.random()*5);
        const absent = Math.floor(Math.random()*2);
        const late = Math.floor(Math.random()*2);
        return { classId: c.id, className: c.name, present, absent, late };
    });

    // Student rollups
    const byStudent = students.map((name, i) => ({
        studentId: `stu_${i+1}`,
        studentName: name,
        present: 1 - Math.floor(Math.random()*1), // either 1 or 0
        absent: Math.floor(Math.random()*1),
        late: Math.floor(Math.random()*1),
    }));

    return NextResponse.json({ date, byClass, byStudent });
}