'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import StudentAverageCard from '../../../../components/StudentAverageCard';
import { api } from '../../../lib/api';

type Guardian = { name?: string | null; email?: string | null; phone?: string | null; relationship?: string | null };
type Note = { id: string; body: string; tags?: string[]; createdAt: string; author?: { name?: string | null } };
type Attendance = { date: string; status: 'Present' | 'Absent' | 'Tardy' | 'Excused' | string; period?: string | null; classroomId?: string | null };
type Student = {
    id: string; firstName?: string | null; lastName?: string | null; name?: string | null;
    studentNumber?: string | null; grade?: string | number | null; classroomName?: string | null;
    guardians?: Guardian[]; notes?: Note[]; attendance?: Attendance[];
};

export default function ParentStudentPage({ params }: { params: { studentId: string } }) {
    const search = useSearchParams();
    const token = search.get('t') || '';
    const studentId = params.studentId;

    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<Student | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let on = true;
        (async () => {
            try {
                setLoading(true); setErr(null);
                const d = token
                    ? await fetch(`/api/parent/view?t=${encodeURIComponent(token)}`).then(r => (r.ok ? r.json() : Promise.reject(new Error('Invalid/expired link.'))))
                    : await api(`/students/${encodeURIComponent(studentId)}?hydrate=1`);
                if (!on) return;
                setStudent(d);
            } catch (e: any) {
                setErr(e?.message || 'Failed to load.');
            } finally {
                if (on) setLoading(false);
            }
        })();
        return () => { on = false; };
    }, [studentId, token]);

    const fullName = useMemo(() => student ? (student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim()) : '', [student]);

    const attendance = student?.attendance || [];
    const attnCounts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const a of attendance) { const s = (a.status || 'Unknown').toLowerCase(); c[s] = (c[s] || 0) + 1; }
        return c;
    }, [attendance]);

    const recentNotes = useMemo(() => (student?.notes || []).slice().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 20), [student]);

    const guardians = student?.guardians || [];

    return (
        <div className="wrap">
            <header className="header">
                <div className="left">
                    <h1 className="title">{loading ? 'Loading…' : (fullName || 'Student')}</h1>
                    <div className="sub">
                        {student?.grade ? <span>Grade {student.grade}</span> : null}
                        {student?.classroomName ? <span> • {student.classroomName}</span> : null}
                        {student?.studentNumber ? <span> • ID: {student.studentNumber}</span> : null}
                    </div>
                </div>
                <div className="right">
                    {!token && <Link href="/students" className="btn">← Back to Students</Link>}
                </div>
            </header>

            {err && <div className="error">{err}</div>}

            <div className="grid">
                <section className="card">
                    <div className="cardHead">
                        <div className="cardTitle">Progress</div>
                        <div className="muted">Overall average with quick category chips.</div>
                    </div>
                    {!student ? <div className="muted">Loading…</div> : <StudentAverageCard studentId={student.id} title="Overall Average" />}
                </section>

                <section className="card">
                    <div className="cardHead">
                        <div className="cardTitle">Attendance</div>
                        <div className="muted">Recent attendance status and totals.</div>
                    </div>

                    {attendance.length === 0 ? (
                        <div className="muted">No attendance records yet.</div>
                    ) : (
                        <>
                            <div className="chips">
                                <span className="pill pill-ok">Present: {attnCounts['present'] || 0}</span>
                                <span className="pill pill-warn">Tardy: {attnCounts['tardy'] || 0}</span>
                                <span className="pill pill-bad">Absent: {attnCounts['absent'] || 0}</span>
                                {attnCounts['excused'] ? <span className="pill">Excused: {attnCounts['excused']}</span> : null}
                            </div>

                            <div className="tableWrap">
                                <table className="table">
                                    <thead><tr><th>Date</th><th>Status</th><th>Period</th></tr></thead>
                                    <tbody>
                                    {attendance.slice(0, 12).map((a, i) => (
                                        <tr key={i}>
                                            <td>{new Date(a.date).toLocaleDateString()}</td>
                                            <td><span className={`badge ${badgeClass(a.status)}`}>{a.status}</span></td>
                                            <td>{a.period || '—'}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                {attendance.length > 12 && <div className="muted mt-1">Showing recent 12 of {attendance.length}.</div>}
                            </div>
                        </>
                    )}
                </section>
            </div>

            <section className="card">
                <div className="cardHead">
                    <div className="cardTitle">Parent/Guardian Contacts</div>
                    <div className="muted">For questions about progress or attendance.</div>
                </div>
                {guardians.length === 0 ? (
                    <div className="muted">No guardians on file.</div>
                ) : (
                    <div className="guardList">
                        {guardians.map((g, i) => {
                            const email = g.email || ''; const phone = g.phone || '';
                            return (
                                <div key={i} className="guard">
                                    <div className="guardName">{g.name || email || phone || '(no name)'}</div>
                                    <div className="guardSub">
                                        {g.relationship ? <span>{g.relationship}</span> : null}
                                        {g.relationship && (email || phone) ? <span> • </span> : null}
                                        {email ? <a className="link" href={`mailto:${email}`}>{email}</a> : null}
                                        {email && phone ? <span> • </span> : null}
                                        {phone ? <a className="link" href={`tel:${phone}`}>{phone}</a> : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="card">
                <div className="cardHead">
                    <div className="cardTitle">Recent Notes (Read-only)</div>
                    <div className="muted">Teacher comments and evidence — last 20.</div>
                </div>
                {recentNotes.length === 0 ? (
                    <div className="muted">No notes yet.</div>
                ) : (
                    <div className="notes">
                        {recentNotes.map(n => (
                            <div key={n.id} className="note">
                                <div className="noteMeta">
                                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                                    {n.author?.name ? <span> • {n.author.name}</span> : null}
                                    {n.tags?.length ? <span> • {n.tags.join(', ')}</span> : null}
                                </div>
                                <div className="noteBody">{n.body}</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <footer className="foot muted">
                Read-only Parent Portal • Link may be time-limited for privacy.
            </footer>

            <style jsx>{`
                .wrap{max-width:1100px;margin:0 auto;padding:16px}
                .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:12px}
                .title{font-size:22px;font-weight:800;letter-spacing:-.01em;margin:0}
                .sub{color:var(--muted)}
                .btn{border:1px solid var(--border);background:rgba(255,255,255,.05);padding:10px 12px;border-radius:12px}
                .error{border:1px solid #6b1b1b;background:rgba(255,0,0,.08);padding:12px;border-radius:12px;margin-bottom:12px}
                .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
                @media (max-width:900px){.grid{grid-template-columns:1fr}}
                .card{border:1px solid var(--border);border-radius:14px;padding:12px;background:rgba(255,255,255,.03)}
                .cardHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px}
                .cardTitle{font-weight:700}
                .muted{color:var(--muted)}
                .mt-1{margin-top:4px}
                .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
                .pill{display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:rgba(255,255,255,.04);font-size:12px}
                .pill-ok{border-color:rgba(34,197,94,.5);background:rgba(34,197,94,.12)}
                .pill-warn{border-color:rgba(234,179,8,.5);background:rgba(234,179,8,.12)}
                .pill-bad{border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.12)}
                .tableWrap{overflow:auto;border:1px solid var(--border);border-radius:12px}
                .table{width:100%;border-collapse:collapse;font-size:14px}
                .table th,.table td{padding:8px 10px;border-bottom:1px solid var(--border)}
                .table th{text-align:left;color:var(--muted);font-weight:600}
                .badge{display:inline-block;padding:4px 8px;border-radius:999px;border:1px solid var(--border);font-size:12px}
                .badge-ok{border-color:rgba(34,197,94,.5);background:rgba(34,197,94,.12)}
                .badge-warn{border-color:rgba(234,179,8,.5);background:rgba(234,179,8,.12)}
                .badge-bad{border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.12)}
                .guardList{display:grid;grid-template-columns:1fr 1fr;gap:10px}
                @media (max-width:900px){.guardList{grid-template-columns:1fr}}
                .guard{border:1px solid var(--border);border-radius:12px;padding:10px;background:rgba(255,255,255,.04)}
                .guardName{font-weight:600;margin-bottom:4px}
                .guardSub{color:var(--muted)}
                .link{text-decoration:underline}
                .notes{display:flex;flex-direction:column;gap:10px}
                .note{border:1px solid var(--border);border-radius:12px;padding:10px;background:rgba(255,255,255,.04)}
                .noteMeta{font-size:12px;color:var(--muted);margin-bottom:6px}
                .noteBody{white-space:pre-wrap;line-height:1.42}
                .foot{text-align:center;font-size:12px;margin-top:12px}
            `}</style>
        </div>
    );
}

function badgeClass(status: string) {
    const s = (status || '').toLowerCase();
    if (s.includes('present')) return 'badge-ok';
    if (s.includes('tardy') || s.includes('late')) return 'badge-warn';
    if (s.includes('absent')) return 'badge-bad';
    return '';
}