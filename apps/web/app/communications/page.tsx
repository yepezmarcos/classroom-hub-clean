'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

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

export default function CommunicationsPage() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [q, setQ] = useState('');
    const [topic, setTopic] = useState<string>('All');
    const [method, setMethod] = useState<'All'|'email'|'sms'|'phone'>('All');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    async function load() {
        try {
            setLoading(true);
            setErr(null);
            const params = new URLSearchParams();
            if (topic !== 'All') params.set('topic', topic);
            if (method !== 'All') params.set('method', method);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            const d = await api(`/comm-logs${params.toString() ? `?${params}` : ''}`);
            setLogs(d?.items || []);
        } catch (e: any) {
            setErr(e?.message || 'Failed to load communication logs');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, []); // initial

    const filtered = useMemo(() => {
        const f = (q || '').trim().toLowerCase();
        if (!f) return logs;
        return logs.filter(l => {
            const hay = [
                l.studentName, l.subject, l.body,
                (l.guardians || []).join(','),
                l.cc || '', l.bcc || '', l.topic || '', l.method
            ].join('\n').toLowerCase();
            return hay.includes(f);
        });
    }, [logs, q]);

    function toCSV(rows: Log[]) {
        const head = ['When','Student','To','Subject','Provider','Method','Topic','Tone','CC','BCC','Body'];
        const body = rows.map(r => [
            new Date(r.createdAt).toLocaleString(),
            r.studentName || '',
            r.guardians.join(', '),
            r.subject || '',
            r.provider || '',
            r.method || '',
            r.topic || '',
            r.tone || '',
            r.cc || '',
            r.bcc || '',
            r.body.replace(/\n/g, ' '),
        ]);
        const csv = [head, ...body].map(a => a.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `communications.csv`; a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="wrap">
            <div className="head">
                <div>
                    <h1 className="title">Communication Log</h1>
                    <p className="muted">Read-only list of emails / contacts saved from the compose drawer.</p>
                </div>
                <div className="chip-row">
                    <Link className="btn" href="/contacts">← Contacts</Link>
                    <button className="btn" onClick={()=>load()} disabled={loading}>Refresh</button>
                    <button className="btn" onClick={()=>toCSV(filtered)} disabled={!filtered.length}>Export CSV</button>
                </div>
            </div>

            <div className="filters">
                <div className="row grow">
                    <label>Search</label>
                    <input className="input" placeholder="Student, guardian, subject, body…" value={q} onChange={(e)=>setQ(e.target.value)} />
                </div>
                <div className="row">
                    <label>Topic</label>
                    <select className="input" value={topic} onChange={e=>setTopic(e.target.value)}>
                        <option>All</option><option>General</option><option>Progress</option><option>Concern</option>
                        <option>Positive</option><option>Attendance</option><option>Behavior</option><option>Assignment</option><option>Meeting</option>
                    </select>
                </div>
                <div className="row">
                    <label>Method</label>
                    <select className="input" value={method} onChange={e=>setMethod(e.target.value as any)}>
                        <option>All</option><option value="email">email</option><option value="sms">sms</option><option value="phone">phone</option>
                    </select>
                </div>
                <div className="row">
                    <label>From</label>
                    <input className="input" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
                </div>
                <div className="row">
                    <label>To</label>
                    <input className="input" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
                </div>
                <div className="row">
                    <label>&nbsp;</label>
                    <button className="btn" onClick={()=>load()} disabled={loading}>Apply</button>
                </div>
            </div>

            {loading && <div className="card">Loading…</div>}
            {err && <div className="card error">Error: {err}</div>}

            {!loading && !err && (
                <div className="list">
                    {filtered.map(l => (
                        <div key={l.id} className="item">
                            <div className="row1">
                                <div className="meta">
                                    <span className="when">{new Date(l.createdAt).toLocaleString()}</span>
                                    {l.topic ? <span className="chip">{l.topic}</span> : null}
                                    <span className="chip">{l.method}</span>
                                    {l.provider ? <span className="chip">{l.provider}</span> : null}
                                </div>
                                {l.studentId ? <Link className="btn" href={`/students/${l.studentId}`}>View student</Link> : null}
                            </div>
                            <div className="row2">
                                <div>
                                    <div className="label">Student</div>
                                    <div className="bold">{l.studentName || '—'}</div>
                                </div>
                                <div>
                                    <div className="label">To</div>
                                    <div>{l.guardians.join(', ')}</div>
                                </div>
                                <div>
                                    <div className="label">Subject</div>
                                    <div className="bold">{l.subject}</div>
                                </div>
                            </div>
                            <div className="row3">
                                <div className="label">Body</div>
                                <div className="body">{l.body}</div>
                                {(l.cc || l.bcc) && (
                                    <div className="small muted" style={{marginTop:6}}>
                                        {l.cc ? <>CC: {l.cc} </> : null}
                                        {l.bcc ? <>• BCC: {l.bcc}</> : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {!filtered.length && <div className="card muted">No matching entries.</div>}
                </div>
            )}

            <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom: 12px; }
        .title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 6px; }
        .muted { color: var(--muted); }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .filters { display:grid; grid-template-columns: 1fr 220px 160px 160px 160px 120px; gap: 10px; margin-bottom: 10px; }
        @media (max-width: 1100px){ .filters { grid-template-columns: 1fr; } }
        .row { display:flex; flex-direction:column; gap:6px; }
        .grow { min-width: 0; }
        label { font-size:12px; color: var(--muted); }
        .input { width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px 12px; color:inherit; }
        .list { display:flex; flex-direction:column; gap:10px; }
        .item { border:1px solid var(--border); border-radius:12px; padding:10px; background: rgba(255,255,255,0.04); }
        .row1 { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .meta { display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:12px; color: var(--muted); }
        .when { opacity:.9; }
        .chip { border:1px solid var(--border); border-radius:999px; padding:4px 8px; background: rgba(255,255,255,0.05); font-size:12px; }
        .row2 { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 8px; }
        @media (max-width: 900px){ .row2 { grid-template-columns: 1fr; } }
        .bold { font-weight:700; }
        .label { font-size:12px; color: var(--muted); }
        .row3 { margin-top: 8px; }
        .body { white-space: pre-wrap; line-height: 1.42; }
        .error { color: #fca5a5; }
        .small { font-size: 12px; }
      `}</style>
        </div>
    );
}