import { NextResponse } from 'next/server';

type BehaviorType = 'positive' | 'neutral' | 'concern';
type Log = {
    id: string;
    studentId: string;
    type: BehaviorType;
    text: string;
    createdAt: string;
    author?: { name?: string | null; email?: string | null } | null;
};

const STORE: Record<string, Log[]> = {}; // studentId -> logs

export async function GET(
    _req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params;
    const items = (STORE[id] || []).slice().sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ items });
}

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    const { id } = params;
    const body = await req.json().catch(()=>null);
    if (!body?.text || !['positive','neutral','concern'].includes(body?.type)) {
        return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
    }
    const log: Log = {
        id: 'bl_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        studentId: id,
        type: body.type,
        text: String(body.text),
        createdAt: new Date().toISOString(),
        author: { name: 'You', email: 'teacher@example.edu' },
    };
    STORE[id] = STORE[id] || [];
    STORE[id].unshift(log);
    return NextResponse.json(log, { status: 201 });
}