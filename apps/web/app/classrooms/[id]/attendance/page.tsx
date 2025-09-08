'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';

/* =========================
   Types
   ========================= */
type Classroom = { id: string; name: string; subject?: string|null; period?: string|null };
type RosterStudent = { id: string; first: string; last: string; pronouns?: string|null; gender?: string|null };
type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Excused';

type AttendanceRecord = {
    studentId: string;
    date: string; // YYYY-MM-DD
    status: AttendanceStatus | null;
    note?: string | null;
    markedAt?: string | null;
};

type AttendancePayload = {
    classroom: Classroom;
    roster: RosterStudent[];
    records: AttendanceRecord[]; // for selected date
};

/* =========================
   Helpers
   ========================= */
function todayLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = `${d.getMonth()+1}`.padStart(2,'0');
    const day = `${d.getDate()}`.padStart(2,'0');
    return `${y}-${m}-${day}`;
}

const STATUSES: { id: AttendanceStatus; label: string; icon: string }[] = [
    { id: 'Present', label: 'Present', icon: '✅' },
    { id: 'Late', label: 'Late', icon: '⏰' },
    { id: 'Absent', label: 'Absent', icon: '❌' },
    { id: 'Excused', label: 'Excused', icon: '📝' },
];

/* =========================
   Page
   ========================= */
export default function AttendancePage() {
    const params = useParams<{ id: string }>();
    const classId = params?.id as string;

    const [cls, setCls] = useState<Classroom | null>(null);
    const [roster, setRoster] = useState<RosterStudent[]>([]);
    const [records, setRecords] = useState<Record<string, AttendanceRecord>>({}); // by studentId
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);

    // controls
    const [date, setDate] = useState<string>(todayLocal());
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState<'All' | AttendanceStatus>('All');

    // export anchor
    const aRef = useRef<HTMLAnchorElement|null>(null);

    /* ===== Load ===== */
    async function load(targetDate = date) {
        setLoading(true);
        try {
            const res: AttendancePayload = await api(`/classrooms/${classId}/attendance?date=${encodeURIComponent(targetDate)}`);
            setCls(res?.classroom || null);
            const rosterArr = Array.isArray(res?.roster) ? res.roster : [];
            setRoster(rosterArr);
            const map: Record<string, AttendanceRecord> = {};
            for (const s of rosterArr) {
                map[s.id] = {
                    studentId: s.id,
                    date: targetDate,
                    status: null,
                    note: '',
                    markedAt: null,
                };
            }
            for (const r of (res?.records || [])) {
                map[r.studentId] = {
                    studentId: r.studentId,
                    date: r.date,
                    status: (r.status ?? null) as AttendanceStatus | null,
                    note: r.note ?? '',
                    markedAt: r.markedAt ?? null,
                };
            }
            setRecords(map);
            setDirty(false);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { if (classId) load(); }, [classId]);
    useEffect(() => { if (classId) load(date); /* reload when date changes */ }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ===== Setters ===== */
    function setStatus(studentId: string, status: AttendanceStatus) {
        setRecords(prev => {
            const old = prev[studentId] || { studentId, date, status: null, note: '' };
            return {
                ...prev,
                [studentId]: {
                    ...old,
                    status,
                    markedAt: new Date().toISOString(),
                }
            };
        });
        setDirty(true);
    }
    function setNote(studentId: string, note: string) {
        setRecords(prev => {
            const old = prev[studentId] || { studentId, date, status: null, note: '' };
            return { ...prev, [studentId]: { ...old, note } };
        });
        setDirty(true);
    }

    /* ===== Bulk ===== */
    function bulk(status: AttendanceStatus) {
        setRecords(prev => {
            const next: Record<string, AttendanceRecord> = {};
            for (const s of roster) {
                const old = prev[s.id] || { studentId: s.id, date, status: null, note: '' };
                next[s.id] = { ...old, status, markedAt: new Date().toISOString() };
            }
            return next;
        });
        setDirty(true);
    }
    function bulkClear() {
        setRecords(prev => {
            const next: Record<string, AttendanceRecord> = {};
            for (const s of roster) {
                const old = prev[s.id] || { studentId: s.id, date, status: null, note: '' };
                next[s.id] = { ...old, status: null, note: '' };
            }
            return next;
        });
        setDirty(true);
    }

    /* ===== Save ===== */
    async function saveAll() {
        const flat: AttendanceRecord[] = roster.map(s => records[s.id] || { studentId: s.id, date, status: null, note: '' });
        await api(`/classrooms/${classId}/attendance`, {
            method: 'POST',
            body: JSON.stringify({ date, records: flat }),
        });
        setDirty(false);
        alert('Attendance saved.');
    }

    /* ===== Derived ===== */
    const filteredRoster = useMemo(() => {
        const s = q.trim().toLowerCase();
        return roster.filter(st => {
            if (s) {
                const hay = `${st.first} ${st.last} ${st.pronouns || st.gender || ''}`.toLowerCase();
                if (!hay.includes(s)) return false;
            }
            if (filter !== 'All') {
                const r = records[st.id];
                if ((r?.status ?? null) !== filter) return false;
            }
            return true;
        });
    }, [roster, q, filter, records]);

    const counts = useMemo(() => {
        let present = 0, late = 0, absent = 0, excused = 0, unmarked = 0;
        for (const s of roster) {
            const st = records[s.id]?.status ?? null;
            if (st === 'Present') present++;
            else if (st === 'Late') late++;
            else if (st === 'Absent') absent++;
            else if (st === 'Excused') excused++;
            else unmarked++;
        }
        return { present, late, absent, excused, unmarked, total: roster.length };
    }, [roster, records]);

    /* ===== Export ===== */
    function exportCsv() {
        const header = ['Student ID','Last','First','Pronouns/Gender','Status','Note','Marked At','Date'];
        const lines = [header.join(',')];
        for (const st of filteredRoster) {
            const r = records[st.id];
            lines.push([
                st.id,
                JSON.stringify(st.last).slice(1,-1),
                JSON.stringify(st.first).slice(1,-1),
                JSON.stringify(st.pronouns || st.gender || '').slice(1,-1),
                r?.status ?? '',
                JSON.stringify(r?.note ?? '').slice(1,-1),
                r?.markedAt ? new Date(r.markedAt).toLocaleString() : '',
                date,
            ].join(','));
        }
        const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = aRef.current;
        if (a) { a.href = url; a.download = `${cls?.name || 'class'}-attendance-${date}.csv`; a.click(); URL.revokeObjectURL(url); }
    }

    /* ===== Render ===== */
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="header-row">
                    <div>
                        <h2 className="title">🗓️ Attendance</h2>
                        <div className="sub mt-1">{cls?.name || 'Class'}</div>
                    </div>
                    <div className="actions wrap">
                        <div className="chip">
                            <span>Date</span>
                            <input
                                className="input-compact"
                                type="date"
                                value={date}
                                onChange={e=>setDate(e.target.value)}
                            />
                        </div>
                        <div className="chip-input">
                            <input
                                className="input-compact"
                                placeholder="Search students…"
                                value={q}
                                onChange={e=>setQ(e.target.value)}
                            />
                        </div>
                        <div className="chip">
                            <span>Filter</span>
                            <select value={filter} onChange={e=>setFilter(e.target.value as any)}>
                                <option>All</option>
                                {STATUSES.map(s=><option key={s.id}>{s.id}</option>)}
                            </select>
                        </div>
                        <button className="btn" onClick={()=>bulk('Present')}>Mark All Present</button>
                        <button className="btn" onClick={()=>bulkClear()}>Clear</button>
                        <a ref={aRef} className="hidden" />
                        <button className="btn" onClick={exportCsv}>⬇️ Export CSV</button>
                        <Link className="btn" href={`/classrooms/${classId}`}>← Back</Link>
                        <button className="btn btn-primary" onClick={saveAll} disabled={!dirty}>💾 Save</button>
                    </div>
                </div>

                {/* Summary */}
                <div className="chip-row mt-2">
                    <div className="pill">{STATUSES[0].icon} Present: <b>{counts.present}</b></div>
                    <div className="pill">{STATUSES[1].icon} Late: <b>{counts.late}</b></div>
                    <div className="pill">{STATUSES[2].icon} Absent: <b>{counts.absent}</b></div>
                    <div className="pill">{STATUSES[3].icon} Excused: <b>{counts.excused}</b></div>
                    <div className="pill">• Unmarked: <b>{counts.unmarked}</b></div>
                    <div className="pill">Total: <b>{counts.total}</b></div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading && <div className="muted">Loading…</div>}
                {!loading && (
                    <div className="table-wrap">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left text-[var(--muted)]">
                                <th className="py-2 name-col">Student</th>
                                <th>Status</th>
                                <th>Note</th>
                                <th className="text-right">Marked</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredRoster.length === 0 && (
                                <tr><td colSpan={4} className="py-2 muted">No students found.</td></tr>
                            )}
                            {filteredRoster.map(st => {
                                const r = records[st.id] || { studentId: st.id, date, status: null, note: '' };
                                return (
                                    <tr key={st.id} className="border-t border-[var(--border)]">
                                        <td className="py-2">
                                            <div className="name">{st.last}, {st.first}</div>
                                            <div className="sub">{st.pronouns || st.gender || ''}</div>
                                        </td>
                                        <td>
                                            <div className="seg">
                                                {STATUSES.map(s => (
                                                    <button
                                                        key={s.id}
                                                        className={`seg-btn ${r.status === s.id ? 'on' : ''}`}
                                                        onClick={()=>setStatus(st.id, s.id)}
                                                        title={s.label}
                                                    >
                                                        <span className="seg-ic">{s.icon}</span> {s.id}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                className="input"
                                                value={r.note ?? ''}
                                                onChange={e=>setNote(st.id, e.target.value)}
                                                placeholder="Optional note (reason, minutes late, etc.)"
                                            />
                                        </td>
                                        <td className="text-right sub">{r.markedAt ? new Date(r.markedAt).toLocaleTimeString() : '—'}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="actions mt-3">
                    <button className="btn btn-primary" onClick={saveAll} disabled={!dirty}>💾 Save</button>
                </div>
            </div>

            {/* Styles */}
            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .sub { font-size: 12px; color: var(--muted); }
        .muted { color: var(--muted); }
        .mt-1 { margin-top: 4px; }
        .mt-2 { margin-top: 8px; }

        .name { font-weight: 600; }
        .card { background: var(--panel, #0e122b); border: 1px solid var(--border,#1f2547); border-radius: 14px; padding: 16px; }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }
        .actions.wrap { flex-wrap: wrap; row-gap: 8px; }

        .chip-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.02); }
        .pill { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); }
        .chip-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .input-compact { width: 220px; background: transparent; border: none; outline: none; color: inherit; }

        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 10px; border-radius:12px; }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }

        .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; color: inherit; }

        .table-wrap { overflow-x:auto; }
        .name-col { min-width: 220px; }

        /* Segmented control */
        .seg { display:flex; gap:8px; flex-wrap:wrap; }
        .seg-btn {
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 10px; border:1px solid var(--border); border-radius:9999px;
          background: rgba(255,255,255,0.04); font-size: 12px;
        }
        .seg-btn.on { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .seg-ic { width: 16px; text-align:center; }

        .hidden { display:none; }
      `}</style>
        </div>
    );
}