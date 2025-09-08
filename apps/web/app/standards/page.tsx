'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

// Expecting your /api/mock/gradebook shape used elsewhere
type GBRow = {
    studentId: string;
    studentName: string;
    standards: { code: string; name?: string; points: number; max: number }[];
};

export default function StandardsHeatmapPage() {
    const [rows, setRows] = useState<GBRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [q, setQ] = useState('');

    async function load() {
        try {
            setLoading(true);
            setErr(null);
            // IMPORTANT: api('/gradebook') maps to /api/mock/gradebook in dev and /api/proxy/gradebook in prod
            const d = await api('/gradebook');
            setRows(d?.rows || d || []); // tolerate either shape
        } catch (e: any) {
            setErr(e?.message || 'Failed to load gradebook');
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { void load(); }, []);

    const { students, standards } = useMemo(() => {
        const students = rows.filter(r => !q.trim() || r.studentName.toLowerCase().includes(q.toLowerCase()));
        const codes = Array.from(new Set(rows.flatMap(r => r.standards.map(s => s.code))));
        return { students, standards: codes };
    }, [rows, q]);

    function pct(points: number, max: number) {
        if (!max) return null;
        return Math.round((points / max) * 100);
    }

    function color(p: number | null) {
        if (p === null || isNaN(p)) return 'transparent';
        // greenish for higher mastery, red for low
        const g = Math.round((p/100)*180);
        const r = Math.round((1 - p/100)*160);
        return `rgba(${r},${g},120,0.28)`;
    }

    function exportCSV() {
        const head = ['Student', ...standards];
        const body = students.map(s => [
            s.studentName,
            ...standards.map(code => {
                const found = s.standards.find(x => x.code === code);
                const p = found ? pct(found.points, found.max) : null;
                return p === null ? '' : `${p}%`;
            })
        ]);
        const csv = [head, ...body].map(a => a.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'standards-mastery.csv'; a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="wrap">
            <div className="head">
                <div>
                    <h1 className="title">Standards Mastery</h1>
                    <p className="muted">Heatmap of mastery (%) per standard across students.</p>
                </div>
                <div className="chip-row">
                    <Link className="btn" href="/dashboard">← Dashboard</Link>
                    <button className="btn" onClick={()=>load()} disabled={loading}>Refresh</button>
                    <button className="btn" onClick={()=>exportCSV()} disabled={!students.length}>Export CSV</button>
                </div>
            </div>

            <div className="controls">
                <div className="row grow">
                    <label>Search students</label>
                    <input className="input" placeholder="Type a name…" value={q} onChange={(e)=>setQ(e.target.value)} />
                </div>
            </div>

            {loading && <div className="card">Loading…</div>}
            {err && <div className="card error">Error: {err}</div>}

            {!loading && !err && (
                <div className="card scroller">
                    <table className="tbl">
                        <thead>
                        <tr>
                            <th className="left sticky">Student</th>
                            {standards.map(code => <th key={code}>{code}</th>)}
                        </tr>
                        </thead>
                        <tbody>
                        {students.map(s => (
                            <tr key={s.studentId}>
                                <td className="left sticky student">{s.studentName}</td>
                                {standards.map(code => {
                                    const itm = s.standards.find(x => x.code === code);
                                    const p = itm ? pct(itm.points, itm.max) : null;
                                    return (
                                        <td key={code} title={itm ? `${itm.points}/${itm.max}` : ''}>
                                            <div className="cell" style={{ background: color(p) }}>
                                                {p === null ? '—' : `${p}%`}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {!students.length && (
                            <tr><td colSpan={1+standards.length} className="muted left">No students.</td></tr>
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
        .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .controls { display:grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 10px; }
        .row { display:flex; flex-direction:column; gap:6px; }
        label { font-size:12px; color: var(--muted); }
        .input { width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px 12px; color:inherit; }

        .card { border: 1px solid var(--border); border-radius: 14px; padding: 12px; background: rgba(255,255,255,0.03); }
        .error { color: #fca5a5; }

        .scroller { overflow:auto; }
        .tbl { width: max(100%, 800px); border-collapse: collapse; }
        th, td { border-bottom: 1px solid var(--border); padding: 8px 10px; text-align: center; }
        th.left, td.left { text-align: left; }
        .sticky { position: sticky; left: 0; background: rgba(8,10,22,0.85); backdrop-filter: blur(4px); }
        .student { min-width: 200px; }
        .cell { padding: 4px 0; border-radius: 8px; }
      `}</style>
        </div>
    );
}