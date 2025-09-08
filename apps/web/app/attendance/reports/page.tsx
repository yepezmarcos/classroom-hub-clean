'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import Link from 'next/link';

type RollupRow = {
    classId?: string | null;
    className?: string | null;
    studentId?: string | null;
    studentName?: string | null;
    present: number;
    absent: number;
    late: number;
};

type ReportPayload = {
    date: string;
    byClass: RollupRow[];
    byStudent: RollupRow[];
};

export default function AttendanceReportsPage() {
    const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10));
    const [tab, setTab] = useState<'class'|'student'>('class');
    const [data, setData] = useState<ReportPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [q, setQ] = useState('');

    async function load() {
        try {
            setLoading(true);
            setErr(null);
            const d = await api(`/attendance/report?date=${encodeURIComponent(date)}`);
            setData(d);
        } catch (e: any) {
            setErr(e?.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [date]);

    const rows = useMemo(() => {
        const list = tab === 'class' ? (data?.byClass || []) : (data?.byStudent || []);
        const f = q.trim().toLowerCase();
        return f ? list.filter(r => (r.className || r.studentName || '').toLowerCase().includes(f)) : list;
    }, [data, tab, q]);

    function toCSV(rows: RollupRow[], kind: 'class'|'student') {
        const head = kind === 'class'
            ? ['Class ID','Class Name','Present','Absent','Late']
            : ['Student ID','Student Name','Present','Absent','Late'];
        const body = rows.map(r => kind === 'class'
            ? [r.classId||'', r.className||'', r.present, r.absent, r.late]
            : [r.studentId||'', r.studentName||'', r.present, r.absent, r.late]
        );
        const csv = [head, ...body].map(a => a.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `attendance-${kind}-${date}.csv`;
        a.click(); URL.revokeObjectURL(url);
    }

    return (
        <div className="wrap">
            <div className="head">
                <div>
                    <h1 className="title">Attendance Reports</h1>
                    <p className="muted">Daily roll-ups by class and by student.</p>
                </div>
                <Link className="btn" href="/dashboard">← Back to Dashboard</Link>
            </div>

            <div className="controls">
                <div className="row">
                    <label>Date</label>
                    <input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
                </div>
                <div className="row">
                    <label>View</label>
                    <div className="tabs">
                        <button className={`tab ${tab==='class'?'on':''}`} onClick={()=>setTab('class')}>By Class</button>
                        <button className={`tab ${tab==='student'?'on':''}`} onClick={()=>setTab('student')}>By Student</button>
                    </div>
                </div>
                <div className="row grow">
                    <label>Search</label>
                    <input className="input" placeholder="Type to filter…" value={q} onChange={(e)=>setQ(e.target.value)} />
                </div>
                <div className="row">
                    <label>&nbsp;</label>
                    <div className="chip-row">
                        <button className="btn" onClick={()=>toCSV(rows, tab)}>Export CSV</button>
                        <button className="btn" onClick={()=>load()} disabled={loading}>Refresh</button>
                    </div>
                </div>
            </div>

            {loading && <div className="card">Loading…</div>}
            {err && <div className="card error">Error: {err}</div>}

            {!loading && !err && (
                <div className="card">
                    <table className="tbl">
                        <thead>
                        <tr>
                            {tab === 'class' ? (
                                <>
                                    <th className="left">Class</th>
                                    <th>Present</th><th>Absent</th><th>Late</th>
                                </>
                            ) : (
                                <>
                                    <th className="left">Student</th>
                                    <th>Present</th><th>Absent</th><th>Late</th>
                                </>
                            )}
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((r, i) => (
                            <tr key={i}>
                                {tab === 'class'
                                    ? <td className="left">{r.className || r.classId}</td>
                                    : <td className="left">{r.studentName || r.studentId}</td>}
                                <td>{r.present}</td>
                                <td>{r.absent}</td>
                                <td>{r.late}</td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><td colSpan={4} className="muted left">No matching rows.</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            <style jsx>{`
                .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
                .head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
                .title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 6px; }
                .muted { color: var(--muted); }
                .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
                .controls { display:grid; grid-template-columns: 180px 220px 1fr 220px; gap: 10px; margin-bottom: 10px; }
                @media (max-width: 1000px){ .controls { grid-template-columns: 1fr; } }
                .row { display:flex; flex-direction:column; gap:6px; }
                .grow { min-width: 0; }
                label { font-size:12px; color: var(--muted); }
                .input { width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px 12px; color:inherit; }
                .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
                .tabs { display:flex; gap:8px; }
                .tab { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 10px; border-radius:999px; }
                .on { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
                .card { border: 1px solid var(--border); border-radius: 14px; padding: 12px; background: rgba(255,255,255,0.03); }
                .error { color: #fca5a5; }
                .tbl { width:100%; border-collapse: collapse; }
                th, td { border-bottom: 1px solid var(--border); padding: 8px 10px; text-align: center; }
                th.left, td.left { text-align: left; }
            `}</style>
        </div>
    );
}