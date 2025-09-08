import { NextRequest, NextResponse } from 'next/server';
import { api } from '../../../lib/api';
import crypto from 'crypto';

function b64url(input: Buffer | string) {
    return Buffer.from(input).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function verify(token: string, secret: string): { ok: boolean; data?: any } {
    const [body, sig] = token.split('.');
    if (!body || !sig) return { ok: false };
    const expect = crypto.createHmac('sha256', secret).update(body).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if (sig !== expect) return { ok: false };
    try {
        const data = JSON.parse(Buffer.from(body.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
        if (!data.exp || Date.now() > data.exp) return { ok: false };
        return { ok: true, data };
    } catch { return { ok: false }; }
}

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('t') || '';
    const secret = process.env.PARENT_TOKEN_SECRET || 'dev-parent-secret-change-me';

    const v = verify(token, secret);
    if (!v.ok || !v.data?.studentId) {
        return NextResponse.json({ error: 'invalid_or_expired' }, { status: 401 });
    }

    try {
        // Reuse your proxy helper
        const s = await api(`/students/${encodeURIComponent(v.data.studentId)}?hydrate=1`);

        // Optionally project to a "safe" shape here if needed.
        return NextResponse.json(s);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'not_found' }, { status: 404 });
    }
}