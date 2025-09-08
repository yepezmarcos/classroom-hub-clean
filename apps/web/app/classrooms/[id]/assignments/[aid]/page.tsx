'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';

type Classroom = { id: string; name: string; subject?: string|null; term?: string|null; period?: string|null };
type Assignment = {
    id: string;
    title: string;
    dueAt?: string | null;
    maxPoints?: number | null;
    published?: boolean;
};

type RosterStudent = {
    id: string;
    first: string;
    last: string;
    pronouns?: string | null;
    gender?: string | null;
};

type Submission = {
    studentId: string;
    submittedAt?: string | null;
    late?: boolean;
    url?: string | null;
    text?: string | null; // optional short response
    attachments?: { name: string; url: string }[];
    score?: number | null;
    comment?: string | null;
    published?: boolean;
    missing?: boolean; // computed by backend or client
};

type LoadResponse = {
    classroom: Classroom;
    assignment: Assignment;
    roster: RosterStudent[];
    submissions: Submission[];
};

export default function AssignmentGraderPage() {
    const params = useParams<{ id: string; aid: string }>();
    const classId = params?.id as string;
    const aid = params?.aid as string;

    const [cls, setCls] = useState<Classroom | null>(null);
    const [assn, setAssn] = useState<Assignment | null>(null);
    const [roster, setRoster] = useState<RosterStudent[]>([]);
    const [rows, setRows] = useState<Record<string, Submission>>({});
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);

    // filters/search
    const [q, setQ] = useState('');
    const [onlyNeeding, setOnlyNeeding] = useState(false); // needs grading

    // drawer (submission view)
    const [openView, setOpenView] = useState(false);
    const [viewing, setViewing] = useState<Submission | null>(null);

    const maxPoints = assn?.maxPoints ?? null;

    async function load() {
        setLoading(true);
        try {
            const res: LoadResponse = await api(`/classrooms/${classId}/assignments/${aid}?hydrate=1`);
            setCls(res?.classroom || null);
            setAssn(res?.assignment || null);
            setRoster(Array.isArray(res?.roster) ? res.roster : []);
            const map: Record<string, Submission> = {};
            (res?.submissions || []).forEach(s => { map[s.studentId] = { ...s }; });
            // ensure every student has a row
            for (const s of (res?.roster || [])) {
                if (!map[s.id]) map[s.id] = { studentId: s.id, score: null, comment: '', submittedAt: null, late: false, url: null, text: null, attachments: [], published: false, missing: true };
                if (map[s.id].submittedAt) map[s.id].missing = false;
            }
            setRows(map);
            setDirty(false);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { if (classId && aid) load(); }, [classId, aid]);

    function setScore(studentId: string, value: string) {
        const clean = value.replace(/[^\d.]/g, '');
        let num = clean === '' ? null : Number(clean);
        if (num != null && isFinite(num)) {
            if (num < 0) num = 0;
            if (maxPoints != null && num > maxPoints) num = maxPoints;
        } else if (clean !== '') {
            return; // ignore invalid keystroke
        } else {
            num = null;
        }
        setRows(prev => ({ ...prev, [studentId]: { ...prev[studentId], score: num } }));
        setDirty(true);
    }

    function setComment(studentId: string, text: string) {
        setRows(prev => ({ ...prev, [studentId]: { ...prev[studentId], comment: text } }));
        setDirty(true);
    }

    function togglePublished(studentId: string) {
        setRows(prev => ({ ...prev, [studentId]: { ...prev[studentId], published: !prev[studentId].published } }));
        setDirty(true);
    }

    function bulkFullCreditSubmitted() {
        if (maxPoints == null) return;
        const next = { ...rows };
        for (const sId of Object.keys(next)) {
            const r = next[sId];
            if (r.submittedAt && (r.score == null || r.score < maxPoints)) next[sId] = { ...r, score: maxPoints };
        }
        setRows(next); setDirty(true);
    }

    function bulkZeroMissing() {
        const next = { ...rows };
        for (const sId of Object.keys(next)) {
            const r = next[sId];
            if (!r.submittedAt) next[sId] = { ...r, score: 0, missing: true };
        }
        setRows(next); setDirty(true);
    }

    function bulkClearScores() {
        const next = { ...rows };
        for (const sId of Object.keys(next)) {
            next[sId] = { ...next[sId], score: null };
        }
        setRows(next); setDirty(true);
    }

    function bulkPublishAll(v: boolean) {
        const next = { ...rows };
        for (const sId of Object.keys(next)) {
            next[sId] = { ...next[sId], published: v };
        }
        setRows(next); setDirty(true);
    }

    async function saveAll() {
        const payload = Object.values(rows).map(r => ({
            studentId: r.studentId,
            score: r.score,
            comment: r.comment ?? '',
            published: !!r.published,
        }));
        await api(`/classrooms/${classId}/assignments/${aid}/grades`, {
            method: 'POST',
            body: JSON.stringify({ grades: payload }),
        });
        setDirty(false);
        alert('Grades saved.');
    }

    const filteredRoster = useMemo(() => {
        const s = q.trim().toLowerCase();
        return roster.filter(st => {
            if (s) {
                const hay = `${st.first} ${st.last} ${st.pronouns || st.gender || ''}`.toLowerCase();
                if (!hay.includes(s)) return false;
            }
            if (onlyNeeding) {
                const row = rows[st.id];
                const needs = (row?.score == null) || (row?.score == 0 && !row?.submittedAt);
                if (!needs) return false;
            }
            return true;
        });
    }, [roster, q, onlyNeeding, rows]);

    // quick stats
    const stats = useMemo(() => {
        const rs = roster.map(r => rows[r.id]).filter(Boolean);
        const graded = rs.filter(r => r.score != null).length;
        const submitted = rs.filter(r => !!r.submittedAt).length;
        const missing = rs.filter(r => !r.submittedAt).length;
        const avg = (() => {
            const sc = rs.filter(r => typeof r.score === 'number') as (Submission & { score: number })[];
            if (!sc.length) return null;
            const total = sc.reduce((a,b) => a + (b.score ?? 0), 0);
            return total / sc.length;
        })();
        return { graded, submitted, missing, avg };
    }, [rows, roster]);

    function openSubmission(sId: string) {
        const s = rows[sId];
        setViewing(s || null);
        setOpenView(true);
    }

    // export CSV
    const aRef = useRef<HTMLAnchorElement|null>(null);
    function exportCsv() {
        const header = ['Student ID','Last','First','Submitted At','Late','Missing','Score','Max','Published','Comment'];
        const lines = [header.join(',')];
        for (const st of roster) {
            const r = rows[st.id] || {};
            const submittedAt = r.submittedAt ? new Date(r.submittedAt).toLocaleString().replace(/,/g,'') : '';
            const line = [
                st.id,
                JSON.stringify(st.last || '').slice(1,-1),
                JSON.stringify(st.first || '').slice(1,-1),
                submittedAt,
                r.late ? 'TRUE' : '',
                r.missing ? 'TRUE' : '',
                r.score ?? '',
                maxPoints ?? '',
                r.published ? 'TRUE' : '',
                JSON.stringify(r.comment || '').slice(1,-1),
            ].join(',');
            lines.push(line);
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = aRef.current;
        if (a) { a.href = url; a.download = `${assn?.title || 'assignment'}-grades.csv`; a.click(); URL.revokeObjectURL(url); }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="header-row">
                    <div>
                        <h2 className="title">📝 {assn?.title || 'Assignment'}</h2>
                        <div className="sub mt-1">
                            {cls?.name || 'Class'}
                            {assn?.dueAt ? ` · Due ${new Date(assn.dueAt).toLocaleDateString()}` : ''}
                            {maxPoints != null ? ` · Max ${maxPoints}` : ''}
                            {assn?.published ? ' · Published' : ' · Draft'}
                        </div>
                    </div>
                    <div className="actions wrap">
                        <div className="chip-input">
                            <input className="input-compact" placeholder="Search students…" value={q} onChange={e=>setQ(e.target.value)} />
                        </div>
                        <button className={`tag ${onlyNeeding ? 'on' : ''}`} onClick={()=>setOnlyNeeding(v=>!v)}>Needs Grading</button>
                        <Link className="btn" href={`/classrooms/${classId}/assignments`}>← Back</Link>
                        <button className="btn btn-primary" onClick={saveAll} disabled={!dirty}>💾 Save All</button>
                        <a ref={aRef} className="hidden" />
                        <button className="btn" onClick={exportCsv}>⬇️ Export CSV</button>
                    </div>
                </div>
            </div>

            {/* Quick stats */}
            <div className="card">
                <div className="chip-row roomy">
                    <div className="chip"><span>Submitted</span><strong>{stats.submitted}</strong></div>
                    <div className="chip"><span>Missing</span><strong>{stats.missing}</strong></div>
                    <div className="chip"><span>Graded</span><strong>{stats.graded}</strong></div>
                    <div className="chip"><span>Average</span><strong>{stats.avg != null ? (Math.round(stats.avg * 10)/10) : '—'}{maxPoints!=null?' / '+maxPoints:''}</strong></div>
                </div>
                <div className="actions wrap mt-2">
                    <button className="btn" onClick={bulkFullCreditSubmitted} disabled={maxPoints==null}>✅ Full credit to submitted</button>
                    <button className="btn" onClick={bulkZeroMissing}>🛑 Zero missing</button>
                    <button className="btn" onClick={bulkClearScores}>🧹 Clear scores</button>
                    <button className="btn" onClick={()=>bulkPublishAll(true)}>📢 Publish all</button>
                    <button className="btn" onClick={()=>bulkPublishAll(false)}>🙈 Unpublish all</button>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading && <div className="muted">Loading…</div>}
                {!loading && filteredRoster.length === 0 && <div className="muted">No students match your filters.</div>}
                {!loading && filteredRoster.length > 0 && (
                    <div className="table-wrap">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left text-[var(--muted)]">
                                <th className="py-2">Student</th>
                                <th>Submission</th>
                                <th style={{width:140}}>Score</th>
                                <th>Comment</th>
                                <th>Publish</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredRoster.map(st => {
                                const r = rows[st.id];
                                const submitted = !!r?.submittedAt;
                                const late = !!r?.late;
                                const missing = !submitted;
                                return (
                                    <tr key={st.id} className="border-t border-[var(--border)]">
                                        <td className="py-2">
                                            <div className="name">{st.last}, {st.first}</div>
                                            <div className="sub">{st.pronouns || st.gender || ''}</div>
                                        </td>
                                        <td>
                                            <div className="chip-row">
                                                {submitted ? <span className="tag on">Submitted</span> : <span className="tag">Missing</span>}
                                                {late && <span className="tag">Late</span>}
                                                <button className="btn" onClick={()=>openSubmission(st.id)}>Open</button>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="score-wrap">
                                                <input
                                                    className="input"
                                                    value={r?.score ?? ''}
                                                    onChange={e=>setScore(st.id, e.target.value)}
                                                    inputMode="decimal"
                                                    placeholder={maxPoints != null ? `0–${maxPoints}` : 'score'}
                                                />
                                                {maxPoints != null && <span className="muted">/ {maxPoints}</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                className="input"
                                                value={r?.comment ?? ''}
                                                onChange={e=>setComment(st.id, e.target.value)}
                                                placeholder="Private note to student"
                                            />
                                        </td>
                                        <td>
                                            <button className={`btn ${r?.published ? 'on' : ''}`} onClick={()=>togglePublished(st.id)}>
                                                {r?.published ? 'Published' : 'Draft'}
                                            </button>
                                        </td>
                                        <td className="text-right">
                                            <Link className="btn" href={`/students/${st.id}`}>Student</Link>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="actions mt-3">
                    <button className="btn btn-primary" onClick={saveAll} disabled={!dirty}>💾 Save All</button>
                </div>
            </div>

            {/* Drawer: Submission */}
            {openView && viewing && (
                <div className="drawer" onClick={(e)=>{ if (e.target===e.currentTarget) setOpenView(false); }}>
                    <div className="drawer-card">
                        <div className="drawer-head">
                            <h3 className="title">Submission</h3>
                            <button className="btn" onClick={()=>setOpenView(false)}>Close</button>
                        </div>

                        <div className="stack-md">
                            <div>
                                <div className="label">Submitted</div>
                                <div className="sub">
                                    {viewing.submittedAt ? `${new Date(viewing.submittedAt).toLocaleString()}${viewing.late ? ' · Late' : ''}` : '—'}
                                </div>
                            </div>

                            {(viewing.text || '') && (
                                <div>
                                    <div className="label">Text Response</div>
                                    <div className="submission-box">{viewing.text}</div>
                                </div>
                            )}

                            {Array.isArray(viewing.attachments) && viewing.attachments.length > 0 && (
                                <div>
                                    <div className="label">Attachments</div>
                                    <ul className="sub mt-1">
                                        {viewing.attachments.map((a,i)=>(
                                            <li key={i}><a className="link" href={a.url} target="_blank" rel="noreferrer">{a.name || a.url}</a></li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {viewing.url && !viewing.attachments?.length && (
                                <div>
                                    <div className="label">Link</div>
                                    <a className="link" href={viewing.url} target="_blank" rel="noreferrer">{viewing.url}</a>
                                </div>
                            )}
                        </div>

                        <div className="drawer-actions">
                            <button className="btn" onClick={()=>setOpenView(false)}>Close</button>
                            <button className="btn btn-primary" onClick={saveAll} disabled={!dirty}>Save All</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .sub { font-size: 12px; color: var(--muted); }
        .muted { color: var(--muted); }
        .mt-1 { margin-top: 4px; }
        .name { font-weight: 600; }

        .card { background: var(--panel, #0e122b); border: 1px solid var(--border,#1f2547); border-radius: 14px; padding: 16px; }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }
        .actions.wrap { flex-wrap: wrap; row-gap: 8px; }

        .chip-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .chip-row.roomy { row-gap: 10px; }
        .chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.02); }
        .tag { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .tag.on { background: rgba(99, 102, 241, 0.18); border-color: rgba(99,102,241,.5); }

        .chip-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .input-compact { width: 300px; max-width: 50vw; background: transparent; border: none; outline: none; color: inherit; }

        .table-wrap { overflow-x: auto; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 10px; border-radius:12px; }
        .btn.on { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .link { text-decoration: underline; }

        .score-wrap { display:flex; align-items:center; gap:8px; }
        .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; color: inherit; }

        .drawer { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: flex-end; z-index: 60; }
        .drawer-card { width: 760px; max-width: 100vw; background: #0b1020; height: 100%; padding: 16px; border-left: 1px solid var(--border); overflow: auto; }
        .drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .drawer-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
        .stack-md { display:flex; flex-direction:column; gap:12px; }

        .submission-box { white-space: pre-wrap; line-height: 1.45; border:1px solid var(--border); border-radius:12px; padding:10px; background: rgba(255,255,255,0.03); }
        .hidden { display:none; }
      `}</style>
        </div>
    );
}