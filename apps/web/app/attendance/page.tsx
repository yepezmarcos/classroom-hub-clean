'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

type Student = {
    id: string;
    first: string;
    last: string;
    grade?: string | null;
};

type Classroom = {
    id: string;
    name: string;
    code?: string | null;
};

type StudentDetail = Student & {
    notes?: Array<{ id: string; body: string; tags?: string[]; createdAt: string }>;
};

type Status = 'PRESENT' | 'ABSENT' | 'TARDY' | 'LEFT_EARLY' | '';

type RowState = {
    status: Status;
    note: string;
    lastSaved?: 'ok' | 'err' | null;
};

function ymd(d: Date) {
    return d.toISOString().slice(0, 10);
}

function classLabel(c: Classroom) {
    return c.name || c.code || c.id;
}

function fullName(s: Student) {
    return `${s.first || ''} ${s.last || ''}`.trim();
}

export default function AttendancePage() {
    // Picking date/class
    const [date, setDate] = useState<string>(() => ymd(new Date()));
    const [classes, setClasses] = useState<Classroom[]>([]);
    const [classroomId, setClassroomId] = useState<string>('all');

    // Roster + per-row state
    const [roster, setRoster] = useState<Student[]>([]);
    const [rows, setRows] = useState<Record<string, RowState>>({});
    const [loading, setLoading] = useState(true);
    const [savingAll, setSavingAll] = useState(false);
    const [q, setQ] = useState('');

    // ===== Load classes (optional) + roster =====
    async function loadClasses() {
        try {
            const list = await api('/classes');
            if (Array.isArray(list) && list.length) {
                setClasses(list);
                if (list[0]?.id) setClassroomId((prev) => (prev === 'all' ? list[0].id : prev));
            } else {
                setClasses([]);
            }
        } catch {
            setClasses([]);
        }
    }

    async function loadRoster() {
        setLoading(true);
        try {
            // If we have a classroom, try its roster; else load all students
            let students: Student[] = [];
            if (classroomId && classroomId !== 'all') {
                try {
                    const roomStudents = await api(`/classes/${classroomId}/students`);
                    if (Array.isArray(roomStudents) && roomStudents.length) {
                        students = roomStudents;
                    }
                } catch {
                    // fall through to /students
                }
            }
            if (!students.length) {
                const all = await api('/students');
                if (Array.isArray(all)) students = all;
            }

            students.sort((a, b) => fullName(a).localeCompare(fullName(b)));

            // Optionally hydrate to pre-fill existing attendance notes for the date
            const withExisting = await Promise.allSettled(
                students.map(async (s) => {
                    try {
                        const d: StudentDetail = await api(`/students/${s.id}?hydrate=1`);
                        const todays = (d.notes || []).filter(
                            (n) =>
                                (n.tags || []).includes('attendance') &&
                                (n.tags || []).includes(`date:${date}`)
                        );
                        // If multiple, pick latest
                        const latest = todays.sort(
                            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                        )[0];

                        let status: Status = '';
                        if (latest?.tags?.includes('status:PRESENT')) status = 'PRESENT';
                        else if (latest?.tags?.includes('status:ABSENT')) status = 'ABSENT';
                        else if (latest?.tags?.includes('status:TARDY')) status = 'TARDY';
                        else if (latest?.tags?.includes('status:LEFT_EARLY')) status = 'LEFT_EARLY';

                        return { ...s, _prefill: { status, note: latest?.body || '' } };
                    } catch {
                        return { ...s, _prefill: { status: '' as Status, note: '' } };
                    }
                })
            );

            const prefills: Record<string, RowState> = {};
            const rosterClean: Student[] = [];
            withExisting.forEach((res, idx) => {
                if (res.status === 'fulfilled') {
                    const base = students[idx];
                    rosterClean.push(base);
                    const pre = (res.value as any)?._prefill as { status: Status; note: string };
                    prefills[base.id] = {
                        status: pre?.status || '',
                        note: pre?.note || '',
                        lastSaved: null,
                    };
                }
            });

            setRoster(rosterClean);
            setRows(prefills);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadClasses();
    }, []);

    useEffect(() => {
        void loadRoster();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classroomId, date]);

    // ===== Derived =====
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return roster;
        return roster.filter((s) =>
            `${fullName(s)} ${s.grade ?? ''}`.toLowerCase().includes(term)
        );
    }, [roster, q]);

    const summary = useMemo(() => {
        const counts = { PRESENT: 0, ABSENT: 0, TARDY: 0, LEFT_EARLY: 0, NONE: 0 };
        for (const s of roster) {
            const st = rows[s.id]?.status || '';
            if (!st) counts.NONE++;
            else (counts as any)[st]++;
        }
        return counts;
    }, [roster, rows]);

    // ===== Actions =====
    function setStatus(id: string, status: Status) {
        setRows((m) => ({ ...m, [id]: { ...(m[id] || { status: '', note: '' }), status, lastSaved: null } }));
    }
    function setNote(id: string, note: string) {
        setRows((m) => ({ ...m, [id]: { ...(m[id] || { status: '', note: '' }), note, lastSaved: null } }));
    }

    async function saveOne(s: Student) {
        const row = rows[s.id] || { status: '' as Status, note: '' };
        // Build a concise body + tags
        const body =
            row.note?.trim() ||
            (row.status ? `${fullName(s)} marked ${row.status.replace('_', ' ').toLowerCase()}.` : '');
        const tags = ['attendance', `date:${date}`, row.status ? `status:${row.status}` : 'status:UNSET'];

        try {
            await api(`/students/${s.id}/notes`, {
                method: 'POST',
                body: JSON.stringify({ body, tags }),
            });
            setRows((m) => ({ ...m, [s.id]: { ...(m[s.id] || { status: '', note: '' }), lastSaved: 'ok' } }));
        } catch {
            setRows((m) => ({ ...m, [s.id]: { ...(m[s.id] || { status: '', note: '' }), lastSaved: 'err' } }));
        }
    }

    async function saveAll() {
        setSavingAll(true);
        try {
            await Promise.all(
                filtered.map((s) => saveOne(s))
            );
        } finally {
            setSavingAll(false);
        }
    }

    function exportCsv() {
        const header = ['Date', 'Class', 'Student', 'Grade', 'Status', 'Note'];
        const className =
            classroomId === 'all' ? 'All Students' : classLabel(classes.find((c) => c.id === classroomId) || { id: 'all', name: 'All Students' });
        const rowsCsv = roster.map((s) => {
            const r = rows[s.id] || { status: '', note: '' };
            const status = r.status || '';
            const note = (r.note || '').replace(/"/g, '""');
            return [date, className, fullName(s), s.grade ?? '', status, note];
        });
        const csv = [header, ...rowsCsv]
            .map((cols) => cols.map((c) => `"${String(c ?? '')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-${date}-${classroomId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ===== UI =====
    return (
        <div className="space-y-6">
            <div className="card">
                <div className="header-row">
                    <h2 className="title">🗓️ Attendance & Behavior</h2>
                    <div className="actions wrap">
                        <Link className="btn" href="/dashboard">← Dashboard</Link>
                        <Link className="btn" href="/students">Students</Link>
                        <Link className="btn" href="/contacts">Contacts</Link>
                    </div>
                </div>

                <div className="chip-row mt-2">
                    <div className="chip">
                        <span>Date</span>
                        <input
                            className="input slim"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div className="chip">
                        <span>Class</span>
                        <select
                            className="input slim"
                            value={classroomId}
                            onChange={(e) => setClassroomId(e.target.value)}
                        >
                            {classes.length > 0 ? (
                                <>
                                    {classes.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {classLabel(c)}
                                        </option>
                                    ))}
                                    <option value="all">All students</option>
                                </>
                            ) : (
                                <option value="all">All students</option>
                            )}
                        </select>
                    </div>

                    <div className="chip">
                        <input
                            className="input bare"
                            placeholder="Filter students…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>

                    <span className="flex-spacer" />

                    <div className="chip-row">
                        <div className="chip">
                            <span className="sub">Present</span><b>{summary.PRESENT}</b>
                        </div>
                        <div className="chip">
                            <span className="sub">Absent</span><b>{summary.ABSENT}</b>
                        </div>
                        <div className="chip">
                            <span className="sub">Tardy</span><b>{summary.TARDY}</b>
                        </div>
                        <div className="chip">
                            <span className="sub">Left Early</span><b>{summary.LEFT_EARLY}</b>
                        </div>
                        <div className="chip">
                            <span className="sub">Unset</span><b>{summary.NONE}</b>
                        </div>
                    </div>

                    <button className="btn btn-primary" onClick={saveAll} disabled={savingAll || loading}>
                        {savingAll ? 'Saving…' : 'Save All'}
                    </button>
                    <button className="btn" onClick={exportCsv} disabled={loading || roster.length === 0}>
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="card">
                {loading && <div className="muted">Loading roster…</div>}
                {!loading && filtered.length === 0 && (
                    <div className="muted">No students found.</div>
                )}

                {!loading && filtered.length > 0 && (
                    <div className="table-wrap mt-2">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left text-[var(--muted)]">
                                <th className="py-2">Student</th>
                                <th>Grade</th>
                                <th>Status</th>
                                <th>Note (optional)</th>
                                <th className="text-right">Save</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map((s) => {
                                const st = rows[s.id] || { status: '' as Status, note: '' };
                                return (
                                    <tr key={s.id} className="border-t border-[var(--border)]">
                                        <td className="py-2">
                                            <Link className="link" href={`/students/${s.id}`}>
                                                {fullName(s)}
                                            </Link>
                                        </td>
                                        <td className="sub">{s.grade ?? '—'}</td>
                                        <td>
                                            <div className="chip-row wrap">
                                                {(['PRESENT','ABSENT','TARDY','LEFT_EARLY'] as Status[]).map((opt) => (
                                                    <button
                                                        key={opt}
                                                        className={`btn ${st.status === opt ? 'on' : ''}`}
                                                        onClick={() => setStatus(s.id, st.status === opt ? '' : opt)}
                                                        title={opt.replace('_',' ')}
                                                    >
                                                        {opt === 'PRESENT' && 'Present'}
                                                        {opt === 'ABSENT' && 'Absent'}
                                                        {opt === 'TARDY' && 'Tardy'}
                                                        {opt === 'LEFT_EARLY' && 'Left Early'}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                className="input"
                                                placeholder="Optional note…"
                                                value={st.note}
                                                onChange={(e) => setNote(s.id, e.target.value)}
                                            />
                                        </td>
                                        <td className="text-right">
                                            <div className="chip-row">
                                                <button className="btn" onClick={() => saveOne(s)}>Save</button>
                                                {st.lastSaved === 'ok' && <span className="sub">✅</span>}
                                                {st.lastSaved === 'err' && <span className="sub">⚠️</span>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .sub { font-size: 12px; color: var(--muted); }
        .muted { color: var(--muted); }
        .mt-2 { margin-top: 8px; }

        .card {
          background: var(--panel, #0e122b);
          border: 1px solid var(--border, #1f2547);
          border-radius: 14px;
          padding: 16px;
        }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }
        .actions.wrap { flex-wrap: wrap; row-gap: 8px; }
        .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .chip-row .flex-spacer { flex: 1; }
        .chip { display:inline-flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); }
        .chip .input.bare { background: transparent; color: inherit; border: none; outline: none; min-width: 240px; }

        .table-wrap { overflow-x:auto; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .btn.on { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .link { text-decoration: underline; }
        .text-right { text-align: right; }
        .input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 12px;
          color: inherit; line-height: 1.35;
          min-width: 220px;
        }
        .input.slim { padding: 6px 10px; min-width: 0; }
      `}</style>
        </div>
    );
}