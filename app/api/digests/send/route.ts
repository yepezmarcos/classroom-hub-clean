// app/api/digests/send/route.ts
import { NextRequest, NextResponse } from 'next/server';

async function sendEmail(to: string, subject: string, text: string) {
    const key = process.env.SENDGRID_API_KEY;
    if (!key) return { ok: false, reason: 'SENDGRID_API_KEY missing' };
    const from = process.env.SENDGRID_FROM || 'noreply@example.com';

    const sg = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: from, name: 'Classroom Hub' },
            subject,
            content: [{ type: 'text/plain', value: text }]
        })
    });
    return { ok: sg.status >= 200 && sg.status < 300, status: sg.status };
}

async function sendSms(to: string, body: string) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM || '';
    if (!sid || !token || !from) return { ok: false, reason: 'Twilio env missing' };

    const creds = Buffer.from(`${sid}:${token}`).toString('base64');
    const form = new URLSearchParams({ To: to, From: from, Body: body });
    const tw = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
    });
    return { ok: tw.status >= 200 && tw.status < 300, status: tw.status };
}

export async function POST(req: NextRequest) {
    const { studentId, guardianEmail, guardianPhone, subject, text, channels = ['email'] } = await req.json();

    const results: any[] = [];
    if (channels.includes('email') && guardianEmail) {
        results.push({ channel: 'email', ...(await sendEmail(guardianEmail, subject || 'Classroom Update', text || '')) });
    }
    if (channels.includes('sms') && guardianPhone) {
        results.push({ channel: 'sms', ...(await sendSms(guardianPhone, text || 'Classroom update available')) });
    }

    return NextResponse.json({ results });
}