'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

type Classroom = {
    id: string;
    name: string;
    subject?: string | null;
    term?: string | null;
    period?: string | null;
    teacherName?: string | null;
    studentCount?: number;
    archived?: boolean;
    createdAt?: string;
};

const TERMS = ['All','T1','T2','T3','Full Year'];
const SUBJECTS_FALLBACK = ['All','Math','ELA','Science','Social Studies','Art','PE'];

export default function ClassroomsPage() {
    const [list, setList] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(false);

    // filters
    const [q, setQ] = useState('');
    const [term, setTerm] = useState('All');
    const [subject, setSubject] = useState('All');
    const [showArchived, setShowArchived] = useState(false);

    // Add drawer
    const [openAdd, setOpenAdd] = useState(false);
    const [name, setName] = useState('');
    const [newTerm, setNewTerm] = useState('T1');
    const [newSubject, setNewSubject] = useState('');
    const [period, setPeriod] = useState('');
    const [busy, setBusy] = useState(false);

    // for subject filter options
    const SUBJECTS = useMemo(() => {
        const unique = new Set<string>();
        for (const c of list) if (c.subject) unique.add(c.subject);
        return ['All', ...Array.from(unique.size ? unique : new Set(SUBJECTS_FALLBACK.slice(1)))];
    }, [list]);

    async function load() {
        setLoading(true);
        try {
            const data: Classroom[] = await api('/classrooms');
            setList(Array.isArray(data) ? data : []);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        return (list || []).filter(c => {
            if (!showArchived && c.archived) return false;
            const t = `${c.name} ${c.subject || ''} ${c.term || ''} ${c.teacherName || ''}`.toLowerCase();
            if (q && !t.includes(q.toLowerCase())) return false;
            if (term !== 'All' && (c.term || '') !== term) return false;
            if (subject !== 'All' && (c.subject || '') !== subject) return false;
            return true;
        });
    }, [list, q, term, subject, showArchived]);

    async function archive(id: string, archived: boolean) {
        await api(`/classrooms/${id}`, { method: 'PATCH', body: JSON.stringify({ archived }) });
        await load();
    }

    async function saveClassroom() {
        if (!name.trim()) return;
        setBusy(true);
        try {
            await api('/classrooms', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim(),
                    subject: newSubject || null,
                    term: newTerm || null,
                    period: period || null,
                }),
            });
            setOpenAdd(false);
            setName(''); setNewSubject(''); setNewTerm('T1'); setPeriod('');
            await load();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            {/* Title */}
            <div className="card">
                <h2 className="title">🏫 Classrooms</h2>
            </div>

            {/* Toolbar */}
            <div className="card">
                <div className="toolbar">
                    <div className="chip-row">
                        <div className="chip-input">
                            <input
                                className="input-compact"
                                placeholder="Search classes, teachers, subjects…"
                                value={q}
                                onChange={e=>setQ(e.target.value)}
                            />
                        </div>

                        <div className="chip">
                            <span>🗓 Term</span>
                            <select value={term} onChange={e=>setTerm(e.target.value)}>
                                {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div className="chip">
                            <span>📘 Subject</span>
                            <select value={subject} onChange={e=>setSubject(e.target.value)}>
                                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <button
                            className={`tag ${showArchived ? 'on' : ''}`}
                            onClick={()=>setShowArchived(v=>!v)}
                            title="Show archived classes"
                        >
                            🗄 Archived
                        </button>
                    </div>

                    <div className="actions">
                        <button className="btn btn-primary" onClick={()=>setOpenAdd(true)}>＋ New Classroom</button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading && <div className="muted">Loading…</div>}
                {!loading && filtered.length === 0 && <div className="muted">No classrooms match your filters.</div>}
                {!loading && filtered.length > 0 && (
                    <div className="table-wrap">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left text-[var(--muted)]">
                                <th className="py-2">Class</th>
                                <th>Subject</th>
                                <th>Term</th>
                                <th>Period</th>
                                <th>Students</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map(c => (
                                <tr key={c.id} className="border-t border-[var(--border)]">
                                    <td className="py-2">
                                        <div className="name">{c.name}</div>
                                        <div className="sub">{c.teacherName || ''}</div>
                                    </td>
                                    <td>{c.subject || '—'}</td>
                                    <td>{c.term || '—'}</td>
                                    <td>{c.period || '—'}</td>
                                    <td>{typeof c.studentCount === 'number' ? c.studentCount : '—'}</td>
                                    <td className="text-right">
                                        <div className="chip-row">
                                            <Link className="btn" href={`/classrooms/${c.id}`}>View</Link>
                                            {!c.archived ? (
                                                <button className="btn" onClick={()=>archive(c.id, true)}>Archive</button>
                                            ) : (
                                                <button className="btn" onClick={()=>archive(c.id, false)}>Unarchive</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add drawer */}
            {openAdd && (
                <div className="drawer" onClick={(e)=>{ if (e.target===e.currentTarget) setOpenAdd(false); }}>
                    <div className="drawer-card">
                        <div className="drawer-head">
                            <h3 className="title">New Classroom</h3>
                            <button className="btn" onClick={()=>setOpenAdd(false)}>Close</button>
                        </div>

                        <div className="grid3">
                            <div>
                                <div className="label">Class Name*</div>
                                <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., 7A Homeroom or Math 7 — Period 2" />
                            </div>
                            <div>
                                <div className="label">Term</div>
                                <select className="input" value={newTerm} onChange={e=>setNewTerm(e.target.value)}>
                                    <option>T1</option><option>T2</option><option>T3</option><option>Full Year</option>
                                </select>
                            </div>
                            <div>
                                <div className="label">Period</div>
                                <input className="input" value={period} onChange={e=>setPeriod(e.target.value)} placeholder="e.g., 2" />
                            </div>
                            <div className="col-span-3">
                                <div className="label">Subject</div>
                                <input className="input" value={newSubject} onChange={e=>setNewSubject(e.target.value)} placeholder="e.g., Math" />
                            </div>
                        </div>

                        <div className="drawer-actions">
                            <button className="btn" onClick={()=>setOpenAdd(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={saveClassroom} disabled={!name.trim() || busy}>
                                {busy ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .muted { color: var(--muted); }
        .card { background: var(--panel, #0e122b); border: 1px solid var(--border,#1f2547); border-radius: 14px; padding: 14px; }
        .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .chip-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .chip select { background: transparent; color: inherit; border: none; outline: none; }
        .chip-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .input-compact { width: 320px; max-width: 50vw; background: transparent; border: none; outline: none; color: inherit; }
        .tag { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .tag.on { background: rgba(99, 102, 241, 0.18); border-color: rgba(99,102,241,.5); }
        .actions { display: flex; gap: 8px; }

        .table-wrap { overflow-x: auto; }
        .name { font-weight: 600; }
        .sub { font-size: 12px; color: var(--muted); }

        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 10px; border-radius:12px; }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }

        .drawer { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: flex-end; z-index: 60; }
        .drawer-card { width: 800px; max-width: 100vw; background: #0b1020; height: 100%; padding: 16px; border-left: 1px solid var(--border); overflow: auto; }
        .drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        @media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } .input-compact { width: 220px; } }
        .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; color: inherit; }
        .drawer-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
      `}</style>
        </div>
    );
}