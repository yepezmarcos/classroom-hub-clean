'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../lib/api';

type RosterStudent = {
    id: string;
    first: string;
    last: string;
    grade?: string | null;
    pronouns?: string | null;
    gender?: string | null;
    iep?: boolean; ell?: boolean; medical?: boolean;
};

type Assignment = {
    id: string;
    title: string;
    dueAt?: string | null;
    maxPoints?: number | null;
    average?: number | null;
    createdAt?: string;
};

type Classroom = {
    id: string;
    name: string;
    subject?: string | null;
    term?: string | null;
    period?: string | null;
    archived?: boolean;
    teacherName?: string | null;
    roster?: RosterStudent[];
    assignments?: Assignment[];
};

export default function ClassroomDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id as string;

    const [cls, setCls] = useState<Classroom | null>(null);
    const [loading, setLoading] = useState(true);

    // edit header
    const [edit, setEdit] = useState(false);
    const [form, setForm] = useState({ name:'', subject:'', term:'', period:'' });

    // roster controls
    const [qRoster, setQRoster] = useState('');
    const [allStudents, setAllStudents] = useState<RosterStudent[]>([]);
    const [addOpen, setAddOpen] = useState(false);
    const [addSearch, setAddSearch] = useState('');
    const candidates = useMemo(() => {
        const ids = new Set((cls?.roster || []).map(s => s.id));
        const q = addSearch.trim().toLowerCase();
        return allStudents
            .filter(s => !ids.has(s.id))
            .filter(s => !q || `${s.first} ${s.last} ${s.grade || ''}`.toLowerCase().includes(q));
    }, [allStudents, cls?.roster, addSearch]);

    // attendance
    type Mark = 'P'|'T'|'A'|'-';
    const [attDate, setAttDate] = useState(() => {
        const d = new Date(); return d.toISOString().slice(0,10);
    });
    const [marks, setMarks] = useState<Record<string, Mark>>({});
    function setMark(studentId: string, m: Mark) {
        setMarks(prev => ({ ...prev, [studentId]: prev[studentId] === m ? '-' : m }));
    }

    // assignments
    const [openAddAsn, setOpenAddAsn] = useState(false);
    const [asnTitle, setAsnTitle] = useState('');
    const [asnDue, setAsnDue] = useState('');
    const [asnMax, setAsnMax] = useState<number | ''>('');

    async function load() {
        setLoading(true);
        try {
            const data: Classroom = await api(`/classrooms/${id}?hydrate=1`);
            setCls(data || null);
            setForm({
                name: data?.name || '',
                subject: data?.subject || '',
                term: data?.term || '',
                period: data?.period || '',
            });
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { if (id) load(); }, [id]);

    useEffect(() => {
        (async () => {
            try {
                const raw = await api('/students');
                const mapped: RosterStudent[] = (raw || []).map((s: any) => ({
                    id: s.id, first: s.first, last: s.last,
                    grade: s.grade ?? null, pronouns: s.pronouns ?? null, gender: s.gender ?? null,
                    iep: !!s.iep, ell: !!s.ell, medical: !!s.medical,
                }));
                setAllStudents(mapped);
            } catch {
                setAllStudents([]);
            }
        })();
    }, []);

    const rosterFiltered = useMemo(() => {
        const q = qRoster.trim().toLowerCase();
        const arr = cls?.roster || [];
        if (!q) return arr;
        return arr.filter(s => (`${s.first} ${s.last} ${s.grade || ''} ${s.pronouns || s.gender || ''}`).toLowerCase().includes(q));
    }, [cls?.roster, qRoster]);

    async function saveHeader() {
        if (!cls) return;
        await api(`/classrooms/${cls.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                name: form.name || null,
                subject: form.subject || null,
                term: form.term || null,
                period: form.period || null,
            }),
        });
        setEdit(false);
        await load();
    }

    async function addStudentToRoster(studentId: string) {
        await api(`/classrooms/${id}/roster`, { method: 'POST', body: JSON.stringify({ studentId }) });
        await load();
    }

    async function removeStudentFromRoster(studentId: string) {
        await api(`/classrooms/${id}/roster/${studentId}`, { method: 'DELETE' });
        await load();
    }

    async function saveAttendance() {
        const payload = Object.entries(marks)
            .filter(([_, m]) => m && m !== '-')
            .map(([studentId, status]) => ({ studentId, status, date: attDate }));
        if (!payload.length) { alert('No marks to save.'); return; }
        await api(`/classrooms/${id}/attendance`, { method: 'POST', body: JSON.stringify({ date: attDate, marks: payload }) });
        setMarks({});
        alert('Attendance saved.');
    }

    async function addAssignment() {
        if (!asnTitle.trim()) return;
        await api(`/classrooms/${id}/assignments`, {
            method: 'POST',
            body: JSON.stringify({
                title: asnTitle.trim(),
                dueAt: asnDue ? new Date(asnDue).toISOString() : null,
                maxPoints: asnMax === '' ? null : Number(asnMax),
            }),
        });
        setOpenAddAsn(false);
        setAsnTitle(''); setAsnDue(''); setAsnMax('');
        await load();
    }

    if (loading) return <div className="space-y-4"><div className="card"><div className="title">Loading…</div></div></div>;
    if (!cls) {
        return (
            <div className="space-y-4">
                <div className="card"><div className="title">Classroom not found</div></div>
                <div className="card"><Link className="btn" href="/classrooms">← Back to Classrooms</Link></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="header-row">
                    <div>
                        <h2 className="title">🏫 {cls.name}</h2>
                        <div className="sub mt-1">
                            {(cls.subject || '—')}
                            {cls.term ? ` · ${cls.term}` : ''}
                            {cls.period ? ` · Period ${cls.period}` : ''}
                        </div>
                    </div>
                    <div className="actions">
                        {!edit && <button className="btn" onClick={()=>setEdit(true)}>✏️ Edit</button>}
                        {edit && (
                            <>
                                <button className="btn" onClick={()=>{ setEdit(false); setForm({ name: cls.name || '', subject: cls.subject || '', term: cls.term || '', period: cls.period || '' }); }}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveHeader}>Save</button>
                            </>
                        )}
                        <Link className="btn" href="/classrooms">← Back</Link>
                    </div>
                </div>

                {edit && (
                    <div className="grid3 mt-3">
                        <div>
                            <div className="label">Name</div>
                            <input className="input" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                            <div className="label">Subject</div>
                            <input className="input" value={form.subject} onChange={e=>setForm(f=>({ ...f, subject: e.target.value }))} />
                        </div>
                        <div>
                            <div className="label">Term</div>
                            <input className="input" value={form.term} onChange={e=>setForm(f=>({ ...f, term: e.target.value }))} placeholder="e.g., T1" />
                        </div>
                        <div>
                            <div className="label">Period</div>
                            <input className="input" value={form.period} onChange={e=>setForm(f=>({ ...f, period: e.target.value }))} placeholder="e.g., 2" />
                        </div>
                    </div>
                )}
            </div>

            {/* Roster + Attendance */}
            <div className="grid2 gap-xl">
                {/* Roster */}
                <div className="card">
                    <div className="flex-between">
                        <h3 className="title">👩‍🎓 Roster</h3>
                        <div className="actions wrap">
                            <div className="chip-input">
                                <input className="input-compact" placeholder="Search roster…" value={qRoster} onChange={e=>setQRoster(e.target.value)} />
                            </div>
                            <button className="btn btn-primary" onClick={()=>setAddOpen(true)}>＋ Add Student</button>
                        </div>
                    </div>

                    <div className="table-wrap mt-3">
                        {(cls.roster || []).length === 0 && <div className="muted">No students yet.</div>}
                        {(cls.roster || []).length > 0 && (
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-[var(--muted)]"><th className="py-2">Student</th><th>Grade</th><th>Flags</th><th></th></tr></thead>
                                <tbody>
                                {rosterFiltered.map(s => (
                                    <tr key={s.id} className="border-t border-[var(--border)]">
                                        <td className="py-2">
                                            <div className="name">{s.last}, {s.first}</div>
                                            <div className="sub">{s.pronouns || s.gender || ''}</div>
                                        </td>
                                        <td>{s.grade || ''}</td>
                                        <td>
                                            <div className="flag-row">
                                                {s.iep && <span className="flag pill">🧩 IEP</span>}
                                                {s.ell && <span className="flag pill">🗣️ ELL</span>}
                                                {s.medical && <span className="flag pill">🏥 Medical</span>}
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <div className="chip-row">
                                                <Link className="btn" href={`/students/${s.id}`}>Open</Link>
                                                <button className="btn" onClick={()=>removeStudentFromRoster(s.id)}>Remove</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Attendance */}
                <div className="card">
                    <div className="flex-between">
                        <h3 className="title">🕒 Attendance</h3>
                        <div className="chip">
                            <span>Date</span>
                            <input type="date" className="input bare-date" value={attDate} onChange={e=>setAttDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="table-wrap mt-3">
                        {(cls.roster || []).length === 0 && <div className="muted">No roster to take attendance.</div>}
                        {(cls.roster || []).length > 0 && (
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-[var(--muted)]"><th className="py-2">Student</th><th>Mark</th></tr></thead>
                                <tbody>
                                {(cls.roster || []).map(s => {
                                    const m = marks[s.id] || '-';
                                    return (
                                        <tr key={s.id} className="border-t border-[var(--border)]">
                                            <td className="py-2"><div className="name">{s.last}, {s.first}</div></td>
                                            <td>
                                                <div className="chip-row">
                                                    <button className={`btn ${m==='P'?'on':''}`} onClick={()=>setMark(s.id,'P')}>Present</button>
                                                    <button className={`btn ${m==='T'?'on':''}`} onClick={()=>setMark(s.id,'T')}>Tardy</button>
                                                    <button className={`btn ${m==='A'?'on':''}`} onClick={()=>setMark(s.id,'A')}>Absent</button>
                                                    <span className="muted">{m==='-' ? '—' : m}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="actions mt-3">
                        <button className="btn btn-primary" onClick={saveAttendance}>Save Attendance</button>
                    </div>
                </div>
            </div>

            {/* Assignments */}
            <div className="card">
                <div className="flex-between">
                    <h3 className="title">📝 Assignments</h3>
                    <div className="actions">
                        <button className="btn btn-primary" onClick={()=>setOpenAddAsn(true)}>＋ New Assignment</button>
                    </div>
                </div>

                <div className="table-wrap mt-3">
                    {(cls.assignments || []).length === 0 && <div className="muted">No assignments yet.</div>}
                    {(cls.assignments || []).length > 0 && (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-[var(--muted)]"><th className="py-2">Title</th><th>Due</th><th>Max</th><th>Avg</th><th></th></tr></thead>
                            <tbody>
                            {(cls.assignments || []).map(a => (
                                <tr key={a.id} className="border-t border-[var(--border)]">
                                    <td className="py-2">{a.title}</td>
                                    <td>{a.dueAt ? new Date(a.dueAt).toLocaleDateString() : '—'}</td>
                                    <td>{typeof a.maxPoints === 'number' ? a.maxPoints : '—'}</td>
                                    <td>{typeof a.average === 'number' ? `${a.average.toFixed(1)}%` : '—'}</td>
                                    <td className="text-right">
                                        <div className="chip-row">
                                            <Link className="btn" href={`/classrooms/${cls.id}/assignments/${a.id}`}>Open</Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Student Drawer */}
            {addOpen && (
                <div className="drawer" onClick={(e)=>{ if (e.target===e.currentTarget) setAddOpen(false); }}>
                    <div className="drawer-card">
                        <div className="drawer-head">
                            <h3 className="title">Add Student to {cls.name}</h3>
                            <button className="btn" onClick={()=>setAddOpen(false)}>Close</button>
                        </div>

                        <div className="chip-input mb-3" style={{display:'inline-flex'}}>
                            <input className="input-compact" placeholder="Search students…" value={addSearch} onChange={e=>setAddSearch(e.target.value)} />
                        </div>

                        <div className="table-wrap">
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-[var(--muted)]"><th className="py-2">Student</th><th>Grade</th><th></th></tr></thead>
                                <tbody>
                                {candidates.slice(0,50).map(s => (
                                    <tr key={s.id} className="border-t border-[var(--border)]">
                                        <td className="py-2"><div className="name">{s.last}, {s.first}</div><div className="sub">{s.pronouns || s.gender || ''}</div></td>
                                        <td>{s.grade || ''}</td>
                                        <td className="text-right"><button className="btn btn-primary" onClick={()=>addStudentToRoster(s.id)}>Add</button></td>
                                    </tr>
                                ))}
                                {candidates.length === 0 && <tr><td colSpan={3} className="py-3 muted">No matching students.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Assignment Drawer */}
            {openAddAsn && (
                <div className="drawer" onClick={(e)=>{ if (e.target===e.currentTarget) setOpenAddAsn(false); }}>
                    <div className="drawer-card">
                        <div className="drawer-head">
                            <h3 className="title">New Assignment</h3>
                            <button className="btn" onClick={()=>setOpenAddAsn(false)}>Close</button>
                        </div>

                        <div className="grid3">
                            <div className="col-span-3">
                                <div className="label">Title*</div>
                                <input className="input" value={asnTitle} onChange={e=>setAsnTitle(e.target.value)} placeholder="e.g., Fractions Quiz" />
                            </div>
                            <div>
                                <div className="label">Due Date</div>
                                <input type="date" className="input" value={asnDue} onChange={e=>setAsnDue(e.target.value)} />
                            </div>
                            <div>
                                <div className="label">Max Points</div>
                                <input className="input" value={asnMax} onChange={e=>setAsnMax(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g., 100" />
                            </div>
                        </div>

                        <div className="drawer-actions">
                            <button className="btn" onClick={()=>setOpenAddAsn(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={addAssignment} disabled={!asnTitle.trim()}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .sub { font-size: 12px; color: var(--muted); }
        .muted { color: var(--muted); }
        .mt-1 { margin-top: 4px; }

        .card { background: var(--panel, #0e122b); border: 1px solid var(--border,#1f2547); border-radius: 14px; padding: 16px; }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }
        .actions.wrap { flex-wrap: wrap; row-gap: 8px; }
        .chip-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

        .grid2 { display:grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
        .gap-xl { gap: 22px; }
        @media (max-width: 1100px) { .grid2 { grid-template-columns: 1fr; } }

        .grid3 { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        @media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } }

        .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; color: inherit; }
        .input.bare-date { background: transparent; border: none; padding: 0; }

        .name { font-weight: 600; }
        .flag-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .flag.pill { padding: 2px 8px; border-radius: 9999px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); }

        .table-wrap { overflow-x: auto; }

        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 10px; border-radius:12px; }
        .btn.on { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }

        .chip-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .input-compact { width: 320px; max-width: 50vw; background: transparent; border: none; outline: none; color: inherit; }
        @media (max-width: 900px) { .input-compact { width: 220px; } }

        .drawer { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: flex-end; z-index: 60; }
        .drawer-card { width: 840px; max-width: 100vw; background: #0b1020; height: 100%; padding: 16px; border-left: 1px solid var(--border); overflow: auto; }
        .drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .drawer-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
      `}</style>
        </div>
    );
}