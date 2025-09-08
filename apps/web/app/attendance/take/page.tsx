'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Link from 'next/link';

type ClassInfo = { id: string; name: string };
type RosterRow = { id: string; name: string; status: 'Present'|'Absent'|'Late' };

export default function TakeAttendancePage() {
    const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10));
    const [classes, setClasses] = useState<ClassInfo[]>([]);
    const [classId, setClassId] = useState<string>('');
    const [roster, setRoster] = useState<RosterRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [q, setQ] = useState('');

    async function loadClasses() {
        try {
            setLoading(true);
            setErr(null);
            const d = await api('/attendance/take'); // returns { classes }
            setClasses(d?.classes || []);
            if (!classId && d?.classes?.length) setClassId(d.classes[0].id);
        } catch (e: any) {
            setErr(e?.message || 'Failed to load classes');
        } finally {
            setLoading(false);
        }
    }

    async function loadRoster(cid: string, on?: string) {
        if (!cid) return;
        try {
            setLoading(true);
            setErr(null);
            const d = await api(`/attendance/take?classId=${encodeURIComponent(cid)}&date=${encodeURIComponent(on || date)}`);
            setRoster(d?.roster || []);
        } catch (e: any) {
            setErr(e?.message || 'Failed to load roster');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void loadClasses(); }, []);
    useEffect(() => { if (classId) void loadRoster(classId, date); }, [classId, date]);

    const visible = useMemo(() => {
        const f = q.trim().toLowerCase();
        return f ? roster.filter(r => r.name.toLowerCase().includes(f)) : roster;
    }, [roster, q]);

    function markAll(status: RosterRow['status']) {
        setRoster(rs => rs.map(r => ({ ...r, status })));
    }
    function toggle(rid: string) {
        setRoster(rs => rs.map(r => r.id !== rid ? r : ({ ...r, status: r.status === 'Present' ? 'Absent' : 'Present' })));
    }

    async function save() {
        try {
            setSaving(true);
            setErr(null);
            await api('/attendance/take', {
                method: 'POST',
                body: JSON.stringify({
                    date,
                    classId,
                    marks: roster.map(r => ({ studentId: r.id, status: r.status })),
                }),
            });
            alert('Attendance saved.');
        } catch (e: any) {
            setErr(e?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="wrap">
            <div className="head">
                <div>
                    <h1 className="title">Take Attendance</h1>
                    <p className="muted">Mark today’s attendance, fast.</p>
                </div>
                <div className="chip-row">
                    <Link className="btn" href="/attendance/reports">Reports →</Link>
                </div>
            </div>

            <div className="controls">
                <div className="row">
                    <label>Date</label>
                    <input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
                </div>
                <div className="row grow">
                    <label>Class</label>
                    <select className="input" value={classId} onChange={(e)=>setClassId(e.target.value)}>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="row grow">
                    <label>Search</label>
                    <input className="input" placeholder="Type a name…" value={q} onChange={(e)=>setQ(e.target.value)} />
                </div>
                <div className="row">
                    <label>&nbsp;</label>
                    <div className="chip-row">
                        <button className="btn" onClick={()=>markAll('Present')}>All Present</button>
                        <button className="btn" onClick={()=>markAll('Absent')}>All Absent</button>
                        <button className="btn" onClick={()=>markAll('Late')}>All Late</button>
                    </div>
                </div>
            </div>

            {loading && <div className="card">Loading…</div>}
            {err && <div className="card error">Error: {err}</div>}

            {!loading && !err && (
                <>
                    <div className="card list">
                        {visible.map(s => (
                            <div key={s.id} className={`rowItem ${s.status}`}>
                                <div className="name">{s.name}</div>
                                <div className="chips">
                                    <button className={`chip ${s.status==='Present'?'on':''}`} onClick={()=>setRoster(rs=>rs.map(r=>r.id===s.id?{...r,status:'Present'}:r))}>Present</button>
                                    <button className={`chip ${s.status==='Absent'?'on':''}`}  onClick={()=>setRoster(rs=>rs.map(r=>r.id===s.id?{...r,status:'Absent'}:r))}>Absent</button>
                                    <button className={`chip ${s.status==='Late'?'on':''}`}    onClick={()=>setRoster(rs=>rs.map(r=>r.id===s.id?{...r,status:'Late'}:r))}>Late</button>
                                </div>
                                <button className="btn tinyBtn" onClick={()=>toggle(s.id)} title="Toggle Present/Absent">Toggle</button>
                            </div>
                        ))}
                        {!visible.length && <div className="muted">No students.</div>}
                    </div>

                    <div className="actions">
                        <button className="btn btn-primary" onClick={()=>save()} disabled={saving || !classId || !roster.length}>
                            {saving ? 'Saving…' : 'Save Attendance'}
                        </button>
                    </div>
                </>
            )}

            <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
        .title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 6px; }
        .muted { color: var(--muted); }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .controls { display:grid; grid-template-columns: 160px 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        @media (max-width: 1000px){ .controls { grid-template-columns: 1fr; } }
        .row { display:flex; flex-direction:column; gap:6px; }
        .grow { min-width: 0; }
        label { font-size:12px; color: var(--muted); }
        .input { width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px 12px; color:inherit; }
        .card { border:1px solid var(--border); border-radius:14px; padding:12px; background: rgba(255,255,255,0.03); }
        .list { display:flex; flex-direction:column; gap:8px; }
        .rowItem { display:grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items:center; border:1px solid var(--border); border-radius:12px; padding:10px; background: rgba(255,255,255,0.04); }
        .name { font-weight:700; }
        .chips { display:flex; gap:8px; }
        .chip { border:1px solid var(--border); border-radius:999px; padding:6px 10px; background: rgba(255,255,255,0.05); font-size: 12px; }
        .on { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
        .actions { display:flex; gap:10px; align-items:center; margin-top: 8px; }
        .tinyBtn { padding: 6px 8px; border-radius: 10px; }
        .error { color: #fca5a5; }
      `}</style>
        </div>
    );
}