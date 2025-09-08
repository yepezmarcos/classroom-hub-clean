import { NextResponse } from 'next/server';

type ClassInfo = { id: string; name: string };
type RosterRow = { id: string; name: string; status: 'Present'|'Absent'|'Late' };

const CLASSES: ClassInfo[] = [
    { id: 'c-ela-5b', name: 'ELA • 5B' },
    { id: 'c-math-5b', name: 'Math • 5B' },
    { id: 'c-sci-5b', name: 'Science • 5B' },
];

const STUDENTS = [
    'Jordan Carter','Maya Singh','Liam Chen','Ava Garcia','Ethan Patel',
    'Noah Johnson','Olivia Brown','Emma Davis','Sophia Wilson','Lucas Lee'
];

let LAST_SAVED: { [key: string]: { [date: string]: RosterRow[] } } = {}; // classId -> date -> roster

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date') || new Date().toISOString().slice(0,10);

    if (!classId) {
        return NextResponse.json({ classes: CLASSES });
    }

    const saved = LAST_SAVED[classId]?.[date];
    const roster: RosterRow[] = saved || STUDENTS.map((name, i) => ({
        id: `stu_${i+1}`,
        name,
        status: Math.random() < 0.94 ? 'Present' : (Math.random() < 0.5 ? 'Late' : 'Absent'),
    }));
    return NextResponse.json({ classes: CLASSES, roster });
}

export async function POST(req: Request) {
    const body = await req.json().catch(()=>null);
    if (!body?.classId || !body?.date || !Array.isArray(body?.marks)) {
        return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
    }
    LAST_SAVED[body.classId] = LAST_SAVED[body.classId] || {};
    LAST_SAVED[body.classId][body.date] = body.marks;
    return NextResponse.json({ ok: true }, { status: 201 });
}