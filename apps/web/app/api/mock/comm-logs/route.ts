import { NextResponse } from 'next/server';

type Log = {
    id: string;
    createdAt: string;
    studentId?: string | null;
    studentName?: string | null;
    guardians: string[];
    subject: string;
    body: string;
    cc?: string | null;
    bcc?: string | null;
    provider?: 'default'|'gmail'|'outlook'|'office';
    topic?: string | null;
    tone?: 'Neutral'|'Warm'|'Professional'|'Encouraging'|'Direct'|null;
    method: 'email' | 'sms' | 'phone';
};

let SEED: Log[] = [
    {
        id: 'cl_1',
        createdAt: new Date(Date.now()-60*60*1000).toISOString(),
        studentId: 'stu_10',
        studentName: 'Jordan Carter',
        guardians: ['parent1@example.com'],
        subject: 'Great progress in reading',
        body: 'Jordan has shown strong growth this week—finishing two chapter books. Keep encouraging nightly reading!',
        provider: 'gmail',
        topic: 'Positive',
        tone: 'Warm',
        cc: '',
        bcc: '',
        method: 'email',
    },
    {
        id: 'cl_2',
        createdAt: new Date(Date.now()-3*60*60*1000).toISOString(),
        studentId: 'stu_07',
        studentName: 'Maya Singh',
        guardians: ['maya.mom@example.com','maya.dad@example.com'],
        subject: 'Missing homework',
        body: 'Maya is missing two math homework assignments. Could you check her folder tonight?',
        provider: 'outlook',
        topic: 'Concern',
        tone: 'Professional',
        cc: 'coteacher@example.edu',
        bcc: '',
        method: 'email',
    },
];

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');
    const method = searchParams.get('method');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let items = [...SEED];

    if (topic && topic !== 'All') items = items.filter(i => (i.topic || '') === topic);
    if (method && method !== 'All') items = items.filter(i => i.method === method);
    if (from) {
        const t = new Date(from).getTime();
        items = items.filter(i => new Date(i.createdAt).getTime() >= t);
    }
    if (to) {
        const t = new Date(to).getTime() + 24*60*60*1000 - 1;
        items = items.filter(i => new Date(i.createdAt).getTime() <= t);
    }

    // Return newest first
    items.sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ items });
}

// Accepts { studentId, studentName, guardians, subject, body, cc?, bcc?, provider?, topic?, tone?, method? }
export async function POST(req: Request) {
    const body = await req.json().catch(()=>null);
    if (!body || !Array.isArray(body.guardians) || !body.subject || !body.body) {
        return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
    }
    const log: Log = {
        id: 'cl_' + Date.now(),
        createdAt: new Date().toISOString(),
        studentId: body.studentId || null,
        studentName: body.studentName || null,
        guardians: body.guardians,
        subject: body.subject,
        body: body.body,
        cc: body.cc || '',
        bcc: body.bcc || '',
        provider: body.provider || 'gmail',
        topic: body.topic || 'General',
        tone: body.tone || 'Warm',
        method: body.method || 'email',
    };
    SEED.unshift(log);
    return NextResponse.json(log, { status: 201 });
}