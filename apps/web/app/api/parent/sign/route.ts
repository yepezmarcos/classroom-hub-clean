import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function b64url(input: Buffer | string) {
    return Buffer.from(input).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function signPayload(payload: object, secret: string) {
    const body = b64url(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    return `${body}.${sig}`;
}
export function verifyToken(token: string, secret: string): { ok: boolean; data?: any; error?: string } {
    const [body, sig] = token.split('.');
    if (!body || !sig) return { ok: false, error: 'bad_token' };
    const expect = crypto.createHmac('sha256', secret).update(body).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (sig !== expect) return { ok: false, error: 'bad_sig' };
    let data: any;
    try { data = JSON.parse(Buffer.from(body.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8')); }
    catch { return { ok: false, error: 'bad_payload' }; }
    if (!data.exp || Date.now() > data.exp) return { ok: false, error: 'expired' };
    return { ok: true, data };
}

export async function POST(req: NextRequest) {
    try {
        const { studentId, hours } = await req.json() as { studentId?: string; hours?: number };
        if (!studentId) return NextResponse.json({ error: 'studentId_required' }, { status: 400 });

        const secret = process.env.PARENT_TOKEN_SECRET || 'dev-parent-secret-change-me';
        const ttlHours = Math.min(Math.max(hours ?? 72, 1), 24 * 30); // 1 hour .. 30 days
        const exp = Date.now() + ttlHours * 60 * 60 * 1000;

        const token = signPayload({ studentId, exp }, secret);

        const origin = req.headers.get('x-forwarded-origin')
            || `${req.nextUrl.protocol}//${req.headers.get('host') || req.nextUrl.host}`;

        const url = `${origin}/parent/students/${encodeURIComponent(studentId)}?t=${encodeURIComponent(token)}`;
        return NextResponse.json({ token, url, exp });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
    }
}