'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../lib/api'; // NOTE: path is correct from /parent/[token]

type Note = {
    id: string;
    body: string;
    tags: string[];
    createdAt: string;
    author?: { name?: string | null; email?: string | null };
};

type ParentStudentPayload = {
    student: { id: string; name: string; grade?: string | null; classroom?: string | null };
    attendance: { present: number; absent: number; late: number; daysTotal?: number };
    behavior?: { positive: number; neutral: number; concern: number };
    notes: Note[];
    comments: { id: string; text: string; createdAt: string; author?: string | null; topic?: string | null }[];
};

export default function ParentStudentPage() {
    const { token } = useParams<{ token: string }>();
    const router = useRouter();
    const [data, setData] = useState<ParentStudentPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    async function load() {
        try {
            setLoading(true);
            setErr(null);
            const d = await api(`/parent/${encodeURIComponent(token)}`);
            setData(d);
        } catch (e: any) {
            setErr(e?.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [token]);

    const attendancePct = useMemo(() => {
        const t = data?.attendance?.daysTotal || (data ? (data.attendance.present + data.attendance.absent) : 0);
        if (!t) return null;
        return Math.round((data!.attendance.present / t) * 100);
    }, [data]);

    return (
        <div className="wrap">
            <div className="head">
                <div>
                    <h1 className="title">Parent Portal</h1>
                    <p className="muted small">Read-only summary for your student</p>
                </div>
                <div className="chip-row">
                    <Link className="btn" href="/parent">← Use a different code</Link>
                    <button className="btn" onClick={()=>load()} disabled={loading}>Refresh</button>
                </div>
            </div>

            {loading && <div className="card">Loading…</div>}
            {err && (
                <div className="card">
                    <div className="error">Could not load data. {err}</div>
                    <button className="btn" onClick={()=>router.push('/parent')}>Try again</button>
                </div>
            )}

            {data && !loading && (
                <div className="grid">
                    <section className="card">
                        <div className="row headRow">
                            <div>
                                <div className="label">Student</div>
                                <div className="big">{data.student.name}</div>
                                <div className="muted small">{[data.student.grade, data.student.classroom].filter(Boolean).join(' • ') || '—'}</div>
                            </div>
                            <div className="chips">
                                {data.behavior ? (
                                    <>
                                        <span className="chip pos">Positive {data.behavior.positive}</span>
                                        <span className="chip neu">Neutral {data.behavior.neutral}</span>
                                        <span className="chip con">Concern {data.behavior.concern}</span>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <div className="statRow">
                            <div className="stat">
                                <div className="label">Present</div>
                                <div className="statNum">{data.attendance.present}</div>
                            </div>
                            <div className="stat">
                                <div className="label">Absent</div>
                                <div className="statNum">{data.attendance.absent}</div>
                            </div>
                            <div className="stat">
                                <div className="label">Late</div>
                                <div className="statNum">{data.attendance.late}</div>
                            </div>
                            <div className="stat">
                                <div className="label">Attendance</div>
                                <div className="statNum">{attendancePct === null ? '—' : `${attendancePct}%`}</div>
                            </div>
                        </div>

                        <div className="muted tiny">Attendance numbers are current as of today.</div>
                    </section>

                    <section className="card">
                        <div className="cardTitle">Teacher Comments</div>
                        {data.comments.length === 0 && <div className="muted">No comments yet.</div>}
                        <div className="list">
                            {data.comments.map(c => (
                                <div key={c.id} className="item">
                                    <div className="meta">
                                        <span className="when">{new Date(c.createdAt).toLocaleString()}</span>
                                        {c.topic ? <span className="tag">{c.topic}</span> : null}
                                        {c.author ? <span className="by">• {c.author}</span> : null}
                                    </div>
                                    <div className="body">{c.text}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="card">
                        <div className="cardTitle">Recent Notes</div>
                        {data.notes.length === 0 && <div className="muted">No notes yet.</div>}
                        <div className="list">
                            {data.notes.map(n => (
                                <div key={n.id} className="item">
                                    <div className="meta">
                                        <span className="when">{new Date(n.createdAt).toLocaleString()}</span>
                                        {(n.tags?.length ? <span className="tag">{n.tags.join(', ')}</span> : null)}
                                        {n.author?.name ? <span className="by">• {n.author.name}</span> : null}
                                    </div>
                                    <div className="body">{n.body}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; margin-bottom: 12px; }
        .title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 4px; }
        .muted { color: var(--muted); }
        .small { font-size: 12px; }
        .tiny { font-size: 11px; margin-top: 6px; opacity: .9; }
        .chip-row, .chips { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .card { border: 1px solid var(--border); border-radius: 14px; padding: 12px; background: rgba(255,255,255,0.03); }
        .grid { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        @media (max-width: 1100px){ .grid { grid-template-columns: 1fr; } }
        .row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
        .headRow { margin-bottom: 8px; }
        .label { font-size:12px; color: var(--muted); }
        .big { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
        .statRow { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-top:8px; }
        .stat { border:1px solid var(--border); border-radius:12px; padding:10px; background: rgba(255,255,255,0.04); }
        .statNum { font-size:18px; font-weight:800; margin-top:4px; }
        .chip { border:1px solid var(--border); border-radius:999px; padding:6px 10px; font-size:12px; background: rgba(255,255,255,0.04); }
        .pos { border-color: rgba(34,197,94,0.55); background: rgba(34,197,94,0.15); }
        .neu { border-color: rgba(148,163,184,0.55); background: rgba(148,163,184,0.15); }
        .con { border-color: rgba(239,68,68,0.55); background: rgba(239,68,68,0.15); }
        .list { display:flex; flex-direction:column; gap:10px; }
        .item { border:1px solid var(--border); border-radius:12px; padding:10px; background: rgba(255,255,255,0.04); }
        .meta { display:flex; gap:10px; flex-wrap:wrap; font-size:12px; color: var(--muted); }
        .when { opacity:.9; }
        .tag { opacity:.9; }
        .by { opacity:.8; }
        .error { color: #fca5a5; margin-bottom: 8px; }
      `}</style>
        </div>
    );
}