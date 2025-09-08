'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

/* =========================
   Types
   ========================= */
type Guardian = {
    id?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    relationship?: string | null;
};
type Note = {
    id: string;
    body: string;
    tags: string[];
    createdAt: string;
    author?: { name?: string | null; email?: string | null };
};
type StudentFromApi = {
    id: string;
    first: string;
    last: string;
    grade?: string | null;
    pronouns?: string | null;
    email?: string | null;
    guardians?: Guardian[];
    notes?: Note[];
    enrollments?: { classroom?: { id: string; name: string } }[];
};
type Settings = {
    jurisdiction?: string;
    terms?: number;
    subjects?: string[];
    lsCategories?: { id: string; label: string }[];
};

/* =========================
   Helpers
   ========================= */
function tagVal(tags: string[] | undefined, key: string) {
    const t = (tags || []).find(x => x.toLowerCase().startsWith(`${key.toLowerCase()}:`));
    return t ? t.split(':').slice(1).join(':') : '';
}
function hasTag(tags: string[] | undefined, val: string) {
    const tl = (tags || []).map(t => t.toLowerCase());
    return tl.includes(val.toLowerCase());
}
function dl(filename: string, text: string) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}
function csvEscape(s: string) {
    const t = String(s ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return /[",\n]/.test(t) ? `"${t}"` : t;
}

/* =========================
   Page
   ========================= */
export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<StudentFromApi[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);

    // filters
    const TERMS = useMemo(() => Array.from({ length: settings?.terms || 3 }, (_, i) => `T${i + 1}`), [settings?.terms]);
    const [term, setTerm] = useState<string>('All');
    const [type, setType] = useState<'All' | 'Learning' | 'Subject' | 'Email'>('All');
    const [grade, setGrade] = useState<string>('All');
    const [subject, setSubject] = useState<string>('All');
    const [q, setQ] = useState('');

    // subjects list
    const allSubjects = useMemo(() => {
        const fromSettings = settings?.subjects || [];
        const fromEnrollments = new Set<string>();
        for (const s of students) (s.enrollments || []).forEach(e => e.classroom?.name && fromEnrollments.add(e.classroom.name));
        const list = Array.from(new Set([...(fromSettings || []), ...Array.from(fromEnrollments)]));
        return list;
    }, [settings?.subjects, students]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [stu, cfg] = await Promise.all([
                    api('/students?hydrate=1'),
                    api('/settings'),
                ]);
                setStudents(Array.isArray(stu) ? stu : []);
                setSettings(cfg || {});
            } catch {
                setStudents([]);
                setSettings({});
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    type Row = {
        studentId: string;
        student: string;
        grade: string;
        type: 'Learning' | 'Subject' | 'Email' | 'Other';
        term: string;
        subject: string;
        tags: string;
        createdAt: string;
        body: string;
    };

    const rows: Row[] = useMemo(() => {
        const out: Row[] = [];
        for (const s of students) {
            for (const n of s.notes || []) {
                const tl = (n.tags || []).map(t => t.toLowerCase());
                const isLearning = tl.includes('learning');
                const isSubject = tl.includes('subject');
                const isEmail = tl.includes('email') || tl.some(t => t.startsWith('method:email'));
                const kind: Row['type'] = isLearning ? 'Learning' : isSubject ? 'Subject' : isEmail ? 'Email' : 'Other';

                const tTerm = tagVal(n.tags, 'term') || '';
                const tSubject = tagVal(n.tags, 'subject') || '';

                out.push({
                    studentId: s.id,
                    student: `${s.last}, ${s.first}`,
                    grade: s.grade || '',
                    type: kind,
                    term: tTerm.toUpperCase(),
                    subject: tSubject,
                    tags: (n.tags || []).join(', '),
                    createdAt: new Date(n.createdAt).toLocaleString(),
                    body: n.body || '',
                });
            }
        }
        return out.sort((a, b) => a.student.localeCompare(b.student));
    }, [students]);

    const filtered = useMemo(() => {
        return rows.filter(r => {
            if (term !== 'All' && r.term !== term) return false;
            if (type !== 'All' && r.type !== type) return false;
            if (grade !== 'All' && (r.grade || '') !== grade) return false;
            if (subject !== 'All' && (r.subject || '').toLowerCase() !== subject.toLowerCase()) return false;
            if (q.trim()) {
                const hay = `${r.student}\n${r.grade}\n${r.type}\n${r.term}\n${r.subject}\n${r.tags}\n${r.body}`.toLowerCase();
                if (!hay.includes(q.toLowerCase())) return false;
            }
            return true;
        });
    }, [rows, term, type, grade, subject, q]);

    function exportCsv() {
        const header = ['Student', 'Grade', 'Type', 'Term', 'Subject', 'Tags', 'CreatedAt', 'Body'];
        const lines = [header.map(csvEscape).join(',')];
        for (const r of filtered) {
            lines.push([
                r.student,
                r.grade ?? '',
                r.type,
                r.term ?? '',
                r.subject ?? '',
                r.tags ?? '',
                r.createdAt,
                r.body ?? '',
            ].map(csvEscape).join(','));
        }
        dl(`reports-${term}-${type}.csv`, lines.join('\n'));
    }

    const gradesList = useMemo(() => {
        const set = new Set<string>();
        students.forEach(s => s.grade && set.add(String(s.grade)));
        return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
    }, [students]);

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="header-row">
                    <div>
                        <h2 className="title">📄 Reports & Export</h2>
                        <div className="sub mt-1">Filter saved comments and export to CSV.</div>
                    </div>
                    <div className="actions">
                        <Link className="btn" href="/students">← Students</Link>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="actions wrap">
                    <div className="chip">
                        <span>Term</span>
                        <select value={term} onChange={e=>setTerm(e.target.value)}>
                            <option>All</option>
                            {TERMS.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="chip">
                        <span>Type</span>
                        <select value={type} onChange={e=>setType(e.target.value as any)}>
                            <option>All</option>
                            <option>Learning</option>
                            <option>Subject</option>
                            <option>Email</option>
                        </select>
                    </div>
                    <div className="chip">
                        <span>Grade</span>
                        <select value={grade} onChange={e=>setGrade(e.target.value)}>
                            {gradesList.map(g => <option key={g}>{g}</option>)}
                        </select>
                    </div>
                    <div className="chip">
                        <span>Subject</span>
                        <select value={subject} onChange={e=>setSubject(e.target.value)}>
                            <option>All</option>
                            {allSubjects.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="chip">
                        <input className="input bare" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
                    </div>
                    <button className="btn btn-primary" onClick={exportCsv} disabled={loading || filtered.length===0}>⬇️ Export CSV</button>
                </div>

                <div className="table-wrap mt-3">
                    {loading && <div className="muted">Loading…</div>}
                    {!loading && filtered.length===0 && <div className="muted">No matching rows.</div>}
                    {!loading && filtered.length>0 && (
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left text-[var(--muted)]">
                                <th className="py-2">Student</th>
                                <th>Grade</th>
                                <th>Type</th>
                                <th>Term</th>
                                <th>Subject</th>
                                <th>Tags</th>
                                <th>When</th>
                                <th>Body</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map((r, i) => (
                                <tr key={`${r.studentId}-${r.id ?? i}`} className="border-t border-[var(--border)]">
                                    <td className="py-2">{r.student}</td>
                                    <td className="sub">{r.grade || '—'}</td>
                                    <td>{r.type}</td>
                                    <td>{r.term || '—'}</td>
                                    <td>{r.subject || '—'}</td>
                                    <td className="sub">{r.tags}</td>
                                    <td className="sub">{r.createdAt}</td>
                                    <td style={{ whiteSpace: 'pre-wrap' }}>{r.body.length > 180 ? r.body.slice(0,180) + '…' : r.body}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .sub { font-size: 12px; color: var(--muted); }
        .card {
          background: var(--panel, #0e122b);
          border: 1px solid var(--border, #1f2547);
          border-radius: 14px;
          padding: 16px;
        }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; flex-wrap: wrap; }
        .chip { display:inline-flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); }
        .chip .input.bare, .chip select { background: transparent; color: inherit; border: none; outline: none; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }s
        .table-wrap { overflow-x:auto; }
      `}</style>
        </div>
    );
}