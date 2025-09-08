'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';

type Assignment = {
    id: string;
    title: string;
    dueAt?: string | null;
    maxPoints?: number | null;
    published?: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
    stats?: { submitted?: number; graded?: number };
};

type Classroom = {
    id: string;
    name: string;
    subject?: string | null;
    term?: string | null;
    period?: string | null;
};

export default function AssignmentsIndexPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id as string;

    const [cls, setCls] = useState<Classroom | null>(null);
    const [list, setList] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);

    // filters/search
    const [q, setQ] = useState('');
    const [showOnlyPublished, setShowOnlyPublished] = useState(false);

    // drawer state
    const [openEdit, setOpenEdit] = useState(false);
    const [editing, setEditing] = useState<Assignment | null>(null);
    const [form, setForm] = useState<{ title: string; dueAt: string; maxPoints: string; published: boolean }>({
        title: '', dueAt: '', maxPoints: '', published: false,
    });

    function resetForm(a?: Assignment | null) {
        setForm({
            title: a?.title || '',
            dueAt: a?.dueAt ? a.dueAt.slice(0,10) : '',
            maxPoints: a?.maxPoints == null ? '' : String(a.maxPoints),
            published: !!a?.published,
        });
    }

    async function load() {
        setLoading(true);
        try {
            const res = await api(`/classrooms/${id}/assignments?hydrate=1`);
            setCls(res?.classroom || null);
            setList(Array.isArray(res?.assignments) ? res.assignments : Array.isArray(res) ? res : []);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { if (id) load(); }, [id]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return (list || [])
            .filter(a => !showOnlyPublished || !!a.published)
            .filter(a => !s || `${a.title} ${a.maxPoints ?? ''}`.toLowerCase().includes(s))
            .sort((a,b) => {
                const ad = a.dueAt ? new Date(a.dueAt).getTime() : 0;
                const bd = b.dueAt ? new Date(b.dueAt).getTime() : 0;
                return ad - bd || (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
            });
    }, [list, q, showOnlyPublished]);

    function onAdd() {
        setEditing(null);
        resetForm(null);
        setOpenEdit(true);
    }
    function onEdit(a: Assignment) {
        setEditing(a);
        resetForm(a);
        setOpenEdit(true);
    }

    async function save() {
        const payload = {
            title: form.title || 'Untitled',
            dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
            maxPoints: form.maxPoints === '' ? null : Number(form.maxPoints),
            published: !!form.published,
        };
        if (editing) {
            await api(`/classrooms/${id}/assignments/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        } else {
            await api(`/classrooms/${id}/assignments`, { method: 'POST', body: JSON.stringify(payload) });
        }
        setOpenEdit(false);
        await load();
    }

    async function togglePublished(a: Assignment) {
        await api(`/classrooms/${id}/assignments/${a.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ published: !a.published }),
        });
        await load();
    }

    async function destroy(a: Assignment) {
        if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
        await api(`/classrooms/${id}/assignments/${a.id}`, { method: 'DELETE' });
        await load();
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="header-row">
                    <div>
                        <h2 className="title">🗂️ Assignments — {cls?.name || 'Class'}</h2>
                        <div className="sub mt-1">
                            {(cls?.subject || '—')}
                            {cls?.term ? ` · ${cls.term}` : ''}
                            {cls?.period ? ` · Period ${cls.period}` : ''}
                        </div>
                    </div>
                    <div className="actions wrap">
                        <div className="chip-input">
                            <input className="input-compact" placeholder="Search assignments…" value={q} onChange={e=>setQ(e.target.value)} />
                        </div>
                        <button className={`tag ${showOnlyPublished ? 'on' : ''}`} onClick={()=>setShowOnlyPublished(v=>!v)}>Published</button>
                        <Link className="btn" href={`/classrooms/${id}`}>← Back</Link>
                        <button className="btn btn-primary" onClick={onAdd}>＋ New Assignment</button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading && <div className="muted">Loading…</div>}
                {!loading && filtered.length === 0 && <div className="muted">No assignments yet.</div>}
                {!loading && filtered.length > 0 && (
                    <div className="table-wrap">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left text-[var(--muted)]">
                                <th className="py-2">Title</th>
                                <th>Due</th>
                                <th>Max</th>
                                <th>Status</th>
                                <th>Activity</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map(a=>(
                                <tr key={a.id} className="border-t border-[var(--border)]">
                                    <td className="py-2">
                                        <div className="name">{a.title}</div>
                                        <div className="sub">ID: {a.id}</div>
                                    </td>
                                    <td>{a.dueAt ? new Date(a.dueAt).toLocaleDateString() : '—'}</td>
                                    <td>{a.maxPoints != null ? a.maxPoints : '—'}</td>
                                    <td>
                                        <button className={`btn ${a.published ? 'on' : ''}`} onClick={()=>togglePublished(a)}>
                                            {a.published ? 'Published' : 'Draft'}
                                        </button>
                                    </td>
                                    <td className="sub">
                                        {(a.stats?.graded ?? 0)} graded
                                        {(a.stats?.submitted ?? 0) ? ` · ${a.stats?.submitted} submitted` : ''}
                                    </td>
                                    <td className="text-right">
                                        <div className="chip-row">
                                            <Link className="btn" href={`/classrooms/${id}/assignments/${a.id}`}>Open</Link>
                                            <button className="btn" onClick={()=>onEdit(a)}>Edit</button>
                                            <button className="btn" onClick={()=>destroy(a)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Drawer */}
            {openEdit && (
                <div className="drawer" onClick={(e)=>{ if (e.target===e.currentTarget) setOpenEdit(false); }}>
                    <div className="drawer-card">
                        <div className="drawer-head">
                            <h3 className="title">{editing ? 'Edit Assignment' : 'New Assignment'}</h3>
                            <button className="btn" onClick={()=>setOpenEdit(false)}>Close</button>
                        </div>

                        <div className="grid3">
                            <div className="col-span-3">
                                <div className="label">Title</div>
                                <input className="input" value={form.title} onChange={e=>setForm(f=>({...f, title:e.target.value}))} />
                            </div>
                            <div>
                                <div className="label">Due Date</div>
                                <input type="date" className="input" value={form.dueAt} onChange={e=>setForm(f=>({...f, dueAt:e.target.value}))} />
                            </div>
                            <div>
                                <div className="label">Max Points</div>
                                <input className="input" value={form.maxPoints} onChange={e=>setForm(f=>({...f, maxPoints:e.target.value.replace(/[^\d]/g,'')}))} placeholder="e.g., 100" />
                            </div>
                            <div>
                                <div className="label">Visibility</div>
                                <button className={`btn ${form.published ? 'on' : ''}`} onClick={()=>setForm(f=>({...f, published: !f.published}))}>
                                    {form.published ? 'Published' : 'Draft'}
                                </button>
                            </div>
                        </div>

                        <div className="drawer-actions">
                            <button className="btn" onClick={()=>setOpenEdit(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={save} disabled={!form.title.trim()}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .sub { font-size: 12px; color: var(--muted); }
        .mt-1 { margin-top: 4px; }
        .muted { color: var(--muted); }
        .name { font-weight: 600; }

        .card { background: var(--panel, #0e122b); border: 1px solid var(--border,#1f2547); border-radius: 14px; padding: 16px; }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }
        .actions.wrap { flex-wrap: wrap; row-gap: 8px; }

        .table-wrap { overflow-x: auto; }

        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 10px; border-radius:12px; }
        .btn.on { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .tag { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .tag.on { background: rgba(99, 102, 241, 0.18); border-color: rgba(99,102,241,.5); }

        .chip-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .input-compact { width: 300px; max-width: 50vw; background: transparent; border: none; outline: none; color: inherit; }

        .drawer { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: flex-end; z-index: 60; }
        .drawer-card { width: 760px; max-width: 100vw; background: #0b1020; height: 100%; padding: 16px; border-left: 1px solid var(--border); overflow: auto; }
        .drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }

        .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        @media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } .input-compact { width: 200px; } }

        .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; color: inherit; }
        .drawer-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
      `}</style>
        </div>
    );
}