'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

type Guardian = { name?: string; email?: string | null; relationship?: string | null };
type Note = { id: string; body: string; tags: string[]; createdAt: string };
type Student = {
    id: string;
    first: string;
    last: string;
    grade?: string | null;
    pronouns?: string | null;
    guardians?: Guardian[];
    notes?: Note[];
};

function hasTag(n: Note, tag: string) {
    const tl = (n.tags || []).map(t=>t.toLowerCase());
    return tl.includes(tag.toLowerCase());
}

export default function ParentPortalStudentPage({ params }: { params: { studentId: string } }) {
    const id = params.studentId;
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const s = await api(`/students/${id}?hydrate=1`);
            setStudent(s || null);
        } finally {
            setLoading(false);
        }
    }
    useEffect(()=>{ void load(); }, [id]);

    const learning = useMemo(()=> (student?.notes || []).filter(n=>hasTag(n,'learning')), [student]);
    const subject  = useMemo(()=> (student?.notes || []).filter(n=>hasTag(n,'subject')),  [student]);
    const emailLog = useMemo(()=> (student?.notes || []).filter(n=>hasTag(n,'email')),    [student]);

    if (loading) return <div className="card"><div className="title">Loading…</div></div>;
    if (!student) return (
        <div className="card">
            <div className="title">Student not found</div>
            <div className="mt-2"><Link className="btn" href="/">← Home</Link></div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="header-row">
                    <h2 className="title">👨‍👩‍👧 Parent Portal — {student.first} {student.last}</h2>
                    <div className="actions">
                        <span className="pill">Read-only</span>
                        <Link className="btn" href="/">← Home</Link>
                    </div>
                </div>
                <div className="sub mt-1">
                    {student.pronouns ? `${student.pronouns} · ` : ''}{student.grade ? `Grade ${student.grade}` : ''}
                </div>
            </div>

            <div className="grid2">
                <div className="stack-md">
                    <div className="card">
                        <div className="title">Learning Skills Comments</div>
                        {learning.length === 0 ? (
                            <div className="muted mt-2">None yet.</div>
                        ) : (
                            <ul className="mt-2 list">
                                {learning.map(n=>(
                                    <li key={n.id} className="li">
                                        <div className="when">{new Date(n.createdAt).toLocaleString()}</div>
                                        <div className="body">{n.body}</div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="card">
                        <div className="title">Subject Comments</div>
                        {subject.length === 0 ? (
                            <div className="muted mt-2">None yet.</div>
                        ) : (
                            <ul className="mt-2 list">
                                {subject.map(n=>(
                                    <li key={n.id} className="li">
                                        <div className="when">{new Date(n.createdAt).toLocaleString()}</div>
                                        <div className="body">{n.body}</div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="stack-md">
                    <div className="card">
                        <div className="title">Attendance (summary)</div>
                        <div className="muted mt-2">Coming soon.</div>
                    </div>

                    <div className="card">
                        <div className="title">Recent Emails Logged</div>
                        {emailLog.length === 0 ? (
                            <div className="muted mt-2">None yet.</div>
                        ) : (
                            <ul className="mt-2 list">
                                {emailLog.map(n=>(
                                    <li key={n.id} className="li">
                                        <div className="when">{new Date(n.createdAt).toLocaleString()}</div>
                                        <div className="body">{n.body}</div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="card">
                        <div className="title">Guardians on File</div>
                        {!student.guardians?.length ? <div className="muted mt-2">—</div> : (
                            <ul className="mt-2">
                                {(student.guardians || []).map((g,i)=>(
                                    <li key={i} className="sub">{g.name || '—'} {g.relationship ? `(${g.relationship})` : ''} {g.email ? `• ${g.email}` : ''}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
        .space-y-6 { display:flex; flex-direction:column; gap:16px; }
        .card { background: var(--panel,#0e122b); border: 1px solid var(--border,#1f2547); border-radius:14px; padding:16px; }
        .title { font-weight:700; font-size:18px; }
        .sub { font-size:12px; color: var(--muted); }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .pill { padding:4px 8px; border-radius:9999px; border:1px solid var(--border); background: rgba(140,140,160,0.12); font-size:12px; }
        .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
        @media (max-width: 1100px) { .grid2 { grid-template-columns: 1fr; } }
        .stack-md { display:flex; flex-direction:column; gap:12px; }
        .list { display:flex; flex-direction:column; gap:10px; }
        .li { border:1px solid var(--border); background: rgba(255,255,255,0.04); border-radius:12px; padding:10px; }
        .when { font-size:12px; color: var(--muted); margin-bottom:6px; }
        .body { white-space:pre-wrap; line-height:1.42; }
        .mt-2 { margin-top: 10px; }
      `}</style>
        </div>
    );
}