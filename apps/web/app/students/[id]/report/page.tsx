'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';

type Note = {
    id: string;
    body: string;
    tags: string[];
    createdAt: string;
    author?: { name?: string | null; email?: string | null };
};
type Student = {
    id: string;
    first: string;
    last: string;
    grade?: string | null;
    pronouns?: string | null;
    gender?: string | null;
    notes?: Note[];
    enrollments?: { classroom?: { id: string; name: string } }[];
};

function getTag(tags: string[] = [], prefix: string) {
    const t = (tags || []).find(x => x.toLowerCase().startsWith(prefix.toLowerCase() + ':'));
    return t ? t.split(':').slice(1).join(':') : '';
}
function isType(n: Note, type: 'learning' | 'subject') {
    return (n.tags || []).map(t => t.toLowerCase()).includes(type);
}
function getTerm(n: Note) {
    const t = getTag(n.tags, 'term').toUpperCase();
    return /^T[1-3]$/.test(t) ? t : 'T1';
}
function getSubject(n: Note) {
    return getTag(n.tags, 'subject') || 'General';
}

export default function StudentReportPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id as string;

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
    useEffect(() => { void load(); }, [id]);

    const grouped = useMemo(() => {
        const out: Record<string, { learning: Note[]; subjects: Record<string, Note[]> }> = {};
        for (const n of student?.notes || []) {
            const term = getTerm(n);
            out[term] ||= { learning: [], subjects: {} };
            if (isType(n, 'learning')) {
                out[term].learning.push(n);
            } else if (isType(n, 'subject')) {
                const subj = getSubject(n);
                out[term].subjects[subj] ||= [];
                out[term].subjects[subj].push(n);
            }
        }
        return out;
    }, [student?.notes]);

    const termsSorted = useMemo(() => Object.keys(grouped).sort((a, b) => a.localeCompare(b)), [grouped]);

    function copyAll() {
        const chunks: string[] = [];
        chunks.push(`${student?.first || ''} ${student?.last || ''}${student?.grade ? ` — Grade ${student?.grade}` : ''}`);
        for (const term of termsSorted) {
            chunks.push(`\n${term}`);
            const g = grouped[term];
            if (g.learning.length) {
                chunks.push('\nLearning Skills:');
                g.learning.forEach(n => chunks.push(n.body));
            }
            const subjKeys = Object.keys(g.subjects);
            if (subjKeys.length) {
                chunks.push('\nSubjects:');
                for (const s of subjKeys) {
                    chunks.push(`\n${s}`);
                    g.subjects[s].forEach(n => chunks.push(n.body));
                }
            }
        }
        navigator.clipboard.writeText(chunks.join('\n\n'));
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="card"><div className="title">Loading…</div></div>
            </div>
        );
    }
    if (!student) {
        return (
            <div className="space-y-4">
                <div className="card"><div className="title">Student not found</div></div>
                <div className="card"><Link className="btn" href="/students">← Back</Link></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="header-row">
                    <div>
                        <h2 className="title">📄 Report — {student.first} {student.last}</h2>
                        <div className="sub mt-1">
                            {student.grade ? `Grade ${student.grade}` : '—'}
                            {(student.pronouns || student.gender) ? ` · ${(student.pronouns || student.gender)}` : ''}
                        </div>
                    </div>
                    <div className="actions">
                        <button className="btn" onClick={() => window.print()}>🖨️ Print</button>
                        <button className="btn" onClick={copyAll}>📋 Copy All</button>
                        <Link className="btn" href={`/students/${student.id}`}>← Back</Link>
                    </div>
                </div>
            </div>

            {termsSorted.length === 0 && (
                <div className="card"><div className="muted">No saved comments yet.</div></div>
            )}

            {termsSorted.map(term => {
                const g = grouped[term];
                const subjectKeys = Object.keys(g.subjects).sort((a, b) => a.localeCompare(b));
                return (
                    <div key={term} className="card">
                        <div className="header-row">
                            <h3 className="title">{term}</h3>
                        </div>

                        {/* Learning */}
                        <div className="section">
                            <div className="section-title">Learning Skills</div>
                            {g.learning.length === 0 && <div className="muted">—</div>}
                            {g.learning.length > 0 && (
                                <div className="stack-md">
                                    {g.learning.map(n => (
                                        <div key={n.id} className="bubble">
                                            <div className="bubble-when sub">{new Date(n.createdAt).toLocaleString()}</div>
                                            <div className="bubble-body">{n.body}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Subjects */}
                        <div className="section">
                            <div className="section-title">Subjects</div>
                            {subjectKeys.length === 0 && <div className="muted">—</div>}
                            {subjectKeys.length > 0 && subjectKeys.map(sk => (
                                <div key={sk} className="subject-block">
                                    <div className="subject-name">{sk}</div>
                                    {(g.subjects[sk] || []).map(n => (
                                        <div key={n.id} className="bubble">
                                            <div className="bubble-when sub">{new Date(n.createdAt).toLocaleString()}</div>
                                            <div className="bubble-body">{n.body}</div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .sub { font-size: 12px; color: var(--muted); }
        .muted { color: var(--muted); }
        .mt-1 { margin-top: 4px; }

        .card {
          background: var(--panel, #0e122b);
          border: 1px solid var(--border, #1f2547);
          border-radius: 14px;
          padding: 16px;
        }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }

        .section { margin-top: 10px; display:flex; flex-direction:column; gap:12px; }
        .section-title { font-weight: 700; opacity: .9; }
        .stack-md { display:flex; flex-direction:column; gap: 10px; }

        .bubble {
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.04);
          border-radius: 12px;
          padding: 10px 12px;
        }
        .bubble-when { margin-bottom: 4px; }
        .bubble-body { white-space: pre-wrap; line-height: 1.5; }

        .subject-block { margin-top: 10px; display:flex; flex-direction:column; gap:8px; }
        .subject-name { font-weight: 600; opacity: .95; }

        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }

        @media print {
          body { background: #fff; color: #000; }
          .card { border: none; background: #fff; padding: 0; }
          .btn, a { display: none !important; }
          .title { font-size: 18px; }
          .bubble { border: 1px solid #ddd; background: #fff; }
        }
      `}</style>
        </div>
    );
}