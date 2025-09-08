'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

/* =========================
   Types
   ========================= */
type Classroom = { id: string; name: string; subject?: string|null; term?: string|null; period?: string|null };
type RosterStudent = { id: string; first: string; last: string; pronouns?: string|null; gender?: string|null };

type Assignment = {
    id: string;
    title: string;
    dueAt?: string | null;
    maxPoints?: number | null;
    published?: boolean;
};

type Grade = {
    studentId: string;
    assignmentId: string;
    score?: number | null;
    comment?: string | null;
    published?: boolean;
    submittedAt?: string | null; // optional; if backend hydrates from submissions
};

type GradebookPayload = {
    classroom: Classroom;
    roster: RosterStudent[];
    assignments: Assignment[];
    grades: Grade[];
};

/* =========================
   Page
   ========================= */
export default function GradebookPage() {
    const params = useParams<{ id: string }>();
    const classId = params?.id as string;
    const router = useRouter();

    const [cls, setCls] = useState<Classroom | null>(null);
    const [roster, setRoster] = useState<RosterStudent[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [grades, setGrades] = useState<Record<string, Record<string, Grade>>>({}); // grades[studentId][assignmentId]
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);

    // filters/search
    const [q, setQ] = useState('');
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [onlyUngraded, setOnlyUngraded] = useState(false);

    // add assignment drawer
    const [openAdd, setOpenAdd] = useState(false);
    const [aTitle, setATitle] = useState('');
    const [aMax, setAMax] = useState<number | ''>('');
    const [aDue, setADue] = useState<string>('');
    const [aPublished, setAPublished] = useState(false);

    // export ref
    const aRef = useRef<HTMLAnchorElement|null>(null);

    /* ====== Load ====== */
    async function load() {
        setLoading(true);
        try {
            const res: GradebookPayload = await api(`/classrooms/${classId}/gradebook?hydrate=1`);
            setCls(res?.classroom || null);
            setRoster(Array.isArray(res?.roster) ? res.roster : []);
            setAssignments(Array.isArray(res?.assignments) ? res.assignments : []);
            const map: Record<string, Record<string, Grade>> = {};
            for (const st of (res?.roster || [])) map[st.id] = {};
            for (const g of (res?.grades || [])) {
                if (!map[g.studentId]) map[g.studentId] = {};
                map[g.studentId][g.assignmentId] = { ...g };
            }
            setGrades(map);
            setDirty(false);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { if (classId) load(); }, [classId]);

    /* ====== Helpers ====== */
    function cell(studentId: string, assignmentId: string): Grade {
        return grades[studentId]?.[assignmentId] ?? { studentId, assignmentId, score: null, comment: '', published: false };
    }

    function setScore(studentId: string, assignmentId: string, raw: string, maxPoints: number | null) {
        const clean = raw.replace(/[^\d.]/g, '');
        let num = clean === '' ? null : Number(clean);
        if (num != null && isFinite(num)) {
            if (num < 0) num = 0;
            if (maxPoints != null && num > maxPoints) num = maxPoints;
        } else if (clean !== '') {
            return;
        } else {
            num = null;
        }
        setGrades(prev => {
            const row = { ...(prev[studentId] || {}) };
            row[assignmentId] = { ...(row[assignmentId] || { studentId, assignmentId }), score: num };
            return { ...prev, [studentId]: row };
        });
        setDirty(true);
    }

    function setComment(studentId: string, assignmentId: string, text: string) {
        setGrades(prev => {
            const row = { ...(prev[studentId] || {}) };
            row[assignmentId] = { ...(row[assignmentId] || { studentId, assignmentId }), comment: text };
            return { ...prev, [studentId]: row };
        });
        setDirty(true);
    }

    function togglePublished(studentId: string, assignmentId: string) {
        setGrades(prev => {
            const row = { ...(prev[studentId] || {}) };
            const old = row[assignmentId] || { studentId, assignmentId, score: null, comment: '' };
            row[assignmentId] = { ...old, published: !old.published };
            return { ...prev, [studentId]: row };
        });
        setDirty(true);
    }

    /* ====== Bulk ====== */
    function bulkClear(assignmentId: string) {
        setGrades(prev => {
            const next = { ...prev };
            for (const s of roster) {
                const row = { ...(next[s.id] || {}) };
                if (row[assignmentId]) row[assignmentId] = { ...row[assignmentId], score: null };
                else row[assignmentId] = { studentId: s.id, assignmentId, score: null, comment: '', published: false };
                next[s.id] = row;
            }
            return next;
        });
        setDirty(true);
    }
    function bulkPublish(assignmentId: string, v: boolean) {
        setGrades(prev => {
            const next = { ...prev };
            for (const s of roster) {
                const row = { ...(next[s.id] || {}) };
                const old = row[assignmentId] || { studentId: s.id, assignmentId, score: null, comment: '' };
                row[assignmentId] = { ...old, published: v };
                next[s.id] = row;
            }
            return next;
        });
        setDirty(true);
    }

    /* ====== Save ====== */
    async function saveAll() {
        const flat: Grade[] = [];
        for (const s of roster) {
            const row = grades[s.id] || {};
            for (const a of assignments) {
                const g = row[a.id];
                if (g) flat.push({ studentId: s.id, assignmentId: a.id, score: g.score ?? null, comment: g.comment ?? '', published: !!g.published });
            }
        }
        await api(`/classrooms/${classId}/gradebook/grades`, {
            method: 'POST',
            body: JSON.stringify({ grades: flat }),
        });
        setDirty(false);
        alert('Gradebook saved.');
    }

    /* ====== Derived ====== */
    const filteredRoster = useMemo(() => {
        const s = q.trim().toLowerCase();
        return roster.filter(st => {
            if (s) {
                const hay = `${st.first} ${st.last} ${st.pronouns || st.gender || ''}`.toLowerCase();
                if (!hay.includes(s)) return false;
            }
            if (onlyMissing || onlyUngraded) {
                const row = grades[st.id] || {};
                const hasIssue = assignments.some(a => {
                    const g = row[a.id];
                    const missing = !(g?.submittedAt); // if submissions info present
                    const ungraded = (g?.score == null);
                    return (onlyMissing && missing) || (onlyUngraded && ungraded);
                });
                if (!hasIssue) return false;
            }
            return true;
        });
    }, [roster, grades, assignments, q, onlyMissing, onlyUngraded]);

    // per-student average (simple mean of percent across assignments with max)
    function studentAverage(stId: string) {
        let have = 0, sumPct = 0;
        for (const a of assignments) {
            const g = grades[stId]?.[a.id];
            if (g?.score != null && a.maxPoints != null && a.maxPoints > 0) {
                sumPct += (g.score / a.maxPoints);
                have++;
            }
        }
        if (!have) return null;
        return Math.round((sumPct / have) * 1000) / 10; // %
    }

    // per-assignment average
    function assignmentAverage(aid: string, maxPoints: number | null) {
        if (!maxPoints || maxPoints <= 0) return null;
        let have = 0, sum = 0;
        for (const st of roster) {
            const g = grades[st.id]?.[aid];
            if (g?.score != null) {
                sum += g.score;
                have++;
            }
        }
        if (!have) return null;
        return Math.round((sum / have) * 10) / 10;
    }

    /* ====== Export CSV ====== */
    function exportCsv() {
        const header = ['Student ID','Last','First', ...assignments.map(a => `${a.title} (${a.maxPoints ?? ''})`), 'Average %'];
        const lines = [header.join(',')];
        for (const st of filteredRoster) {
            const cells = assignments.map(a => {
                const g = grades[st.id]?.[a.id];
                if (g?.score == null) return '';
                return a.maxPoints != null ? `${g.score}/${a.maxPoints}` : String(g.score);
            });
            const avg = studentAverage(st.id);
            lines.push([
                st.id,
                JSON.stringify(st.last).slice(1,-1),
                JSON.stringify(st.first).slice(1,-1),
                ...cells,
                avg != null ? `${avg}%` : ''
            ].join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = aRef.current;
        if (a) { a.href = url; a.download = `${cls?.name || 'class'}-gradebook.csv`; a.click(); URL.revokeObjectURL(url); }
    }

    /* ====== Add Assignment ====== */
    async function createAssignment() {
        const title = aTitle.trim();
        if (!title) return;
        const payload: Partial<Assignment> = {
            title,
            maxPoints: typeof aMax === 'number' ? aMax : (aMax === '' ? null : Number(aMax)),
            dueAt: aDue ? new Date(aDue).toISOString() : null,
            published: !!aPublished,
        };
        const created = await api(`/classrooms/${classId}/assignments`, { method:'POST', body: JSON.stringify(payload) });
        setOpenAdd(false);
        setATitle(''); setAMax(''); setADue(''); setAPublished(false);
        if (created?.id) {
            // Optional: route to its grader
            // router.push(`/classrooms/${classId}/assignments/${created.id}`);
            await load();
        } else {
            await load();
        }
    }

    /* ====== Render ====== */
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="header-row">
                    <div>
                        <h2 className="title">📊 Gradebook</h2>
                        <div className="sub mt-1">{cls?.name || 'Class'}</div>
                    </div>
                    <div className="actions wrap">
                        <div className="chip-input">
                            <input className="input-compact" placeholder="Search students…" value={q} onChange={e=>setQ(e.target.value)} />
                        </div>
                        <button className={`tag ${onlyMissing ? 'on' : ''}`} onClick={()=>setOnlyMissing(v=>!v)}>Missing</button>
                        <button className={`tag ${onlyUngraded ? 'on' : ''}`} onClick={()=>setOnlyUngraded(v=>!v)}>Ungraded</button>
                        <button className="btn" onClick={()=>setOpenAdd(true)}>＋ New Assignment</button>
                        <a ref={aRef} className="hidden" />
                        <button className="btn" onClick={exportCsv}>⬇️ Export CSV</button>
                        <Link className="btn" href={`/classrooms/${classId}`}>← Back</Link>
                        <button className="btn btn-primary" onClick={saveAll} disabled={!dirty}>💾 Save All</button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading && <div className="muted">Loading…</div>}
                {!loading && (
                    <div className="gradebook-wrap">
                        <table className="gradebook">
                            <thead>
                            <tr>
                                <th className="sticky-col left name-col">Student</th>
                                {assignments.map(a=>(
                                    <th key={a.id} className="assign-col">
                                        <div className="assign-head">
                                            <div className="assign-title">
                                                <button
                                                    className="link"
                                                    onClick={()=>router.push(`/classrooms/${classId}/assignments/${a.id}`)}
                                                    title="Open assignment grader"
                                                >
                                                    {a.title}
                                                </button>
                                            </div>
                                            <div className="assign-sub">
                                                {(a.dueAt ? `Due ${new Date(a.dueAt).toLocaleDateString()}` : 'No due date')}
                                                {a.maxPoints != null ? ` · /${a.maxPoints}` : ''}
                                                {a.published ? ' · Published' : ' · Draft'}
                                            </div>
                                            <div className="chip-row mt-1">
                                                <button className="btn" onClick={()=>bulkClear(a.id)}>🧹 Clear</button>
                                                <button className="btn" onClick={()=>bulkPublish(a.id, true)}>📢 Publish</button>
                                                <button className="btn" onClick={()=>bulkPublish(a.id, false)}>🙈 Unpublish</button>
                                            </div>
                                            <div className="assign-avg sub mt-1">
                                                Avg: {assignmentAverage(a.id, a.maxPoints) ?? '—'}{a.maxPoints!=null?` / ${a.maxPoints}`:''}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="sticky-col right avg-col">Average %</th>
                            </tr>
                            </thead>

                            <tbody>
                            {filteredRoster.length === 0 && (
                                <tr><td className="muted py-2" colSpan={assignments.length + 2}>No students match your filters.</td></tr>
                            )}
                            {filteredRoster.map(st => (
                                <tr key={st.id}>
                                    <td className="sticky-col left name-col">
                                        <div className="name">{st.last}, {st.first}</div>
                                        <div className="sub">{st.pronouns || st.gender || ''}</div>
                                    </td>

                                    {assignments.map(a => {
                                        const g = cell(st.id, a.id);
                                        return (
                                            <td key={a.id} className="grade-cell">
                                                <div className="cell-stack">
                                                    <div className="score-wrap">
                                                        <input
                                                            className="input score-input"
                                                            value={g.score ?? ''}
                                                            onChange={(e)=>setScore(st.id, a.id, e.target.value, a.maxPoints ?? null)}
                                                            placeholder={a.maxPoints != null ? `0–${a.maxPoints}` : 'score'}
                                                            inputMode="decimal"
                                                            aria-label={`Score for ${st.first} ${st.last} – ${a.title}`}
                                                        />
                                                        {a.maxPoints != null && <span className="muted">/ {a.maxPoints}</span>}
                                                        <button
                                                            className={`btn pub-btn ${g.published ? 'on':''}`}
                                                            onClick={()=>togglePublished(st.id, a.id)}
                                                            title={g.published ? 'Published' : 'Draft'}
                                                        >
                                                            {g.published ? '✓' : '•'}
                                                        </button>
                                                    </div>
                                                    <input
                                                        className="input comment-input"
                                                        value={g.comment ?? ''}
                                                        onChange={(e)=>setComment(st.id, a.id, e.target.value)}
                                                        placeholder="Comment"
                                                        aria-label={`Comment for ${st.first} ${st.last} – ${a.title}`}
                                                    />
                                                </div>
                                            </td>
                                        );
                                    })}

                                    <td className="sticky-col right avg-col">
                                        <div className="avg-bubble">{studentAverage(st.id) != null ? `${studentAverage(st.id)}%` : '—'}</div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="actions mt-3">
                    <button className="btn btn-primary" onClick={saveAll} disabled={!dirty}>💾 Save All</button>
                </div>
            </div>

            {/* Add Assignment Drawer */}
            {openAdd && (
                <div className="drawer" onClick={(e)=>{ if (e.target===e.currentTarget) setOpenAdd(false); }}>
                    <div className="drawer-card">
                        <div className="drawer-head">
                            <h3 className="title">New Assignment</h3>
                            <button className="btn" onClick={()=>setOpenAdd(false)}>Close</button>
                        </div>

                        <div className="grid3">
                            <div className="col-span-3">
                                <div className="label">Title</div>
                                <input className="input" value={aTitle} onChange={e=>setATitle(e.target.value)} placeholder="e.g., Unit 3 Quiz" />
                            </div>

                            <div>
                                <div className="label">Max Points</div>
                                <input
                                    className="input"
                                    value={aMax}
                                    onChange={e=>{
                                        const s = e.target.value.replace(/[^\d]/g,'');
                                        setAMax(s==='' ? '' : Number(s));
                                    }}
                                    placeholder="e.g., 20"
                                />
                            </div>

                            <div>
                                <div className="label">Due (optional)</div>
                                <input className="input" type="datetime-local" value={aDue} onChange={e=>setADue(e.target.value)} />
                            </div>

                            <div>
                                <div className="label">Status</div>
                                <button className={`btn ${aPublished ? 'on' : ''}`} onClick={()=>setAPublished(v=>!v)}>
                                    {aPublished ? 'Published' : 'Draft'}
                                </button>
                            </div>
                        </div>

                        <div className="drawer-actions">
                            <button className="btn" onClick={()=>setOpenAdd(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={createAssignment} disabled={!aTitle.trim()}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Styles */}
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
        .chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.02); }
        .tag { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .tag.on { background: rgba(99, 102, 241, 0.18); border-color: rgba(99,102,241,.5); }

        .chip-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .input-compact { width: 300px; max-width: 50vw; background: transparent; border: none; outline: none; color: inherit; }

        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 10px; border-radius:12px; }
        .btn.on { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .link { text-decoration: underline; }

        .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; color: inherit; }
        .score-input { width: 90px; }

        /* Drawer */
        .drawer { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: flex-end; z-index: 60; }
        .drawer-card { width: 760px; max-width: 100vw; background: #0b1020; height: 100%; padding: 16px; border-left: 1px solid var(--border); overflow: auto; }
        .drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        @media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } }
        .drawer-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }

        /* Gradebook table */
        .gradebook-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 12px; }
        .gradebook { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 960px; }
        thead th, tbody td { background: transparent; }
        thead th { position: sticky; top: 0; z-index: 3; background: var(--panel, #0e122b); }
        .assign-col { min-width: 280px; }
        .name-col { min-width: 240px; }
        .avg-col { min-width: 120px; text-align: center; }

        .sticky-col { position: sticky; background: var(--panel, #0e122b); z-index: 2; }
        .sticky-col.left { left: 0; box-shadow: 1px 0 0 0 var(--border) inset; }
        .sticky-col.right { right: 0; box-shadow: -1px 0 0 0 var(--border) inset; }

        .gradebook th, .gradebook td { border-bottom: 1px solid var(--border); padding: 10px 12px; vertical-align: top; }
        .gradebook tbody tr:hover td { background: rgba(255,255,255,0.02); }

        .assign-head { display:flex; flex-direction:column; gap:6px; }
        .assign-title { font-weight: 700; }
        .assign-sub { font-size: 12px; color: var(--muted); }

        .cell-stack { display:flex; flex-direction:column; gap:8px; }
        .score-wrap { display:flex; align-items:center; gap:8px; }
        .comment-input { font-size: 12px; }
        .pub-btn { padding: 4px 8px; font-size: 12px; border-radius: 9999px; }

        .avg-bubble { display:inline-flex; align-items:center; justify-content:center; min-width: 68px; padding: 6px 10px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); }
        .hidden { display:none; }
      `}</style>
        </div>
    );
}