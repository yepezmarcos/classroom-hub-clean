'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api'; // path is correct from /settings/templates

type CommentTemplate = {
    id: string;
    subject?: string | null;
    text: string;
    tags: string[];
    updatedAt?: string;
    createdAt?: string;
};

const LS_KEY = 'local_templates_fallback_v1';

const DEFAULT_TONE: 'Neutral'|'Warm'|'Professional'|'Encouraging'|'Direct' =
    (typeof window !== 'undefined' && (localStorage.getItem('teacher_default_tone') as any)) || 'Warm';
const DEFAULT_TOPIC =
    (typeof window !== 'undefined' && localStorage.getItem('teacher_default_topic')) || 'General';

export default function TemplatesPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [items, setItems] = useState<CommentTemplate[]>([]);
    const [q, setQ] = useState('');
    const [topicFilter, setTopicFilter] = useState<string>('All');
    const [error, setError] = useState<string | null>(null);

    // drawer/editor
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<CommentTemplate | null>(null);

    // AI helper
    const [aiHint, setAiHint] = useState('');
    const [aiTone, setAiTone] = useState<typeof DEFAULT_TONE>(DEFAULT_TONE);
    const [aiTopic, setAiTopic] = useState<string>(DEFAULT_TOPIC);
    const [aiLength, setAiLength] = useState<'Short'|'Medium'|'Long'>('Medium');
    const [aiLoading, setAiLoading] = useState(false);

    async function load() {
        setLoading(true); setError(null);
        try {
            const list = await api('/comments');
            setItems(Array.isArray(list) ? normalize(list) : []);
        } catch {
            // local fallback
            try {
                const raw = localStorage.getItem(LS_KEY);
                const local = raw ? JSON.parse(raw) : [];
                setItems(normalize(local));
                setError('Templates API unavailable — using local drafts only.');
            } catch {
                setItems([]);
                setError('Could not load templates.');
            }
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { void load(); }, []);

    function normalize(list: any[]): CommentTemplate[] {
        return (list || []).map((t) => ({
            id: String(t.id ?? t._id ?? cryptoRandomId()),
            subject: t.subject ?? '',
            text: t.text ?? t.body ?? '',
            tags: Array.isArray(t.tags) ? t.tags : (typeof t.tags === 'string' ? splitTags(t.tags) : []),
            createdAt: t.createdAt ?? t.created_at ?? undefined,
            updatedAt: t.updatedAt ?? t.updated_at ?? undefined,
        }));
    }

    function cryptoRandomId() {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
        return 'tmp_' + Math.random().toString(36).slice(2, 10);
    }

    function splitTags(s: string) {
        return (s || '')
            .split(/[,\s]+/)
            .map((t) => t.trim())
            .filter(Boolean);
    }

    const topics = useMemo(() => {
        const set = new Set<string>();
        for (const t of items) {
            const topicTag = (t.tags || []).find((x) => x.toLowerCase().startsWith('topic:'));
            const topic = topicTag ? (topicTag.split(':')[1] || 'General') : 'General';
            set.add(cap(topic));
        }
        return ['All', ...Array.from(set).sort((a, b) => (a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)))];
    }, [items]);

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        return items
            .filter((t) => topicFilter === 'All' || belongsToTopic(t, topicFilter))
            .filter((t) => {
                if (!query) return true;
                const hay = `${t.subject || ''}\n${t.text}\n${(t.tags || []).join(' ')}`.toLowerCase();
                return hay.includes(query);
            })
            .sort((a, b) => {
                const ad = new Date(b.updatedAt || b.createdAt || 0).getTime();
                const bd = new Date(a.updatedAt || a.createdAt || 0).getTime();
                if (ad && bd) return ad - bd;
                return (a.subject || '').localeCompare(b.subject || '');
            });
    }, [items, q, topicFilter]);

    function belongsToTopic(t: CommentTemplate, topic: string) {
        const tag = (t.tags || []).find((x) => x.toLowerCase().startsWith('topic:'));
        const detected = tag ? cap(tag.split(':')[1] || 'General') : 'General';
        return detected === topic;
    }
    function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

    async function persistLocal(next: CommentTemplate[]) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
    }

    async function createTemplate(partial: Omit<CommentTemplate, 'id'>) {
        setSaving(true);
        try {
            const res = await api('/comments', { method: 'POST', body: JSON.stringify(partial) });
            const created = normalize([res])[0];
            setItems((prev) => [created, ...prev]);
            await persistLocal([created, ...items]);
            return created;
        } catch {
            const created: CommentTemplate = { id: cryptoRandomId(), ...partial };
            setItems((prev) => [created, ...prev]);
            await persistLocal([created, ...items]);
            return created;
        } finally { setSaving(false); }
    }

    async function updateTemplate(id: string, patch: Partial<CommentTemplate>) {
        setSaving(true);
        try {
            const res = await api(`/comments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) });
            const next = normalize([res])[0];
            setItems((prev) => prev.map((t) => (t.id === id ? next : t)));
            await persistLocal(items.map((t) => (t.id === id ? next : t)));
            return next;
        } catch {
            const next = items.map((t) => (t.id === id ? { ...t, ...patch } : t));
            setItems(next);
            await persistLocal(next);
        } finally { setSaving(false); }
    }

    async function deleteTemplate(id: string) {
        const prev = items;
        setItems((p) => p.filter((t) => t.id !== id));
        setSaving(true);
        try {
            await api(`/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await persistLocal(prev.filter((t) => t.id !== id));
        } catch {
            await persistLocal(prev.filter((t) => t.id !== id));
        } finally { setSaving(false); }
    }

    function openNew() {
        setEditing({
            id: '',
            subject: '',
            text: '',
            tags: ['topic:' + (aiTopic || 'General').toLowerCase()],
        });
        setOpen(true);
    }
    function openEdit(t: CommentTemplate) {
        setEditing({ ...t, tags: [...(t.tags || [])] });
        setOpen(true);
    }
    function closeEditor() { setOpen(false); setTimeout(() => setEditing(null), 200); }

    async function saveEditor() {
        if (!editing) return;
        const payload: Omit<CommentTemplate, 'id'> = {
            subject: (editing.subject || '').trim(),
            text: (editing.text || '').trim(),
            tags: cleanupTags(editing.tags || []),
        };
        if (!payload.text) return;
        if (editing.id) await updateTemplate(editing.id, payload);
        else await createTemplate(payload);
        closeEditor();
    }

    function cleanupTags(tags: string[]) {
        const flat = (tags || []).map((t) => t.trim()).filter(Boolean);
        const hasTopic = flat.some((t) => t.toLowerCase().startsWith('topic:'));
        if (!hasTopic) flat.push(`topic:${(aiTopic || 'General').toLowerCase()}`);
        return Array.from(new Set(flat));
    }

    async function aiDraftIntoEditor() {
        if (!editing) openNew();
        if (!aiHint.trim()) return;
        setAiLoading(true);
        try {
            const body = { hint: aiHint, tone: aiTone, topic: aiTopic, length: aiLength };
            const res = await api('/ai/suggest/comments', { method: 'POST', body: JSON.stringify(body) });
            const suggestion = Array.isArray(res) ? res[0] : res;
            const subj = suggestion?.subject || (editing?.subject || '');
            const txt = suggestion?.text || suggestion?.body || editing?.text || '';
            setEditing((cur) => (cur ? { ...cur, subject: subj, text: txt } : cur));
        } finally { setAiLoading(false); }
    }

    return (
        <div className="wrap">
            <div className="head">
                <div>
                    <h1 className="title">Template Manager</h1>
                    <p className="muted">Create, edit, and organize email templates. These appear inside the Compose Email drawer.</p>
                </div>
                <div className="chip-row">
                    <a className="btn" href="/settings/communication">Communication Settings</a>
                    <button className="btn btn-primary" onClick={openNew}>+ New Template</button>
                </div>
            </div>

            <div className="toolbar">
                <input
                    className="input"
                    placeholder="Search templates by subject, text, or tag…"
                    value={q}
                    onChange={(e)=>setQ(e.target.value)}
                />
                <select className="input slim" value={topicFilter} onChange={(e)=>setTopicFilter(e.target.value)}>
                    {topics.map((t) => <option key={t}>{t}</option>)}
                </select>
            </div>

            {error && <div className="warn">{error}</div>}

            <div className="grid">
                {/* left: grouped list */}
                <div className="card">
                    <div className="cardTitle">Browse</div>
                    {loading ? (
                        <div className="muted">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="muted">No templates match your filters.</div>
                    ) : (
                        <div className="list">
                            {groupByTopic(filtered).map(([topic, list]) => (
                                <div key={topic} className="group">
                                    <div className="groupHead">
                                        <div className="groupTitle">{topic}</div>
                                        <div className="muted">{list.length} template{list.length !== 1 ? 's' : ''}</div>
                                    </div>
                                    <div className="groupBody">
                                        {list.map((t) => (
                                            <button key={t.id} className="rowBtn" onClick={()=>openEdit(t)}>
                                                <div className="rowLine">
                                                    <div className="rowSubject">{t.subject || 'Untitled'}</div>
                                                    {!!t.tags?.length && <div className="tags">{t.tags.join(' • ')}</div>}
                                                </div>
                                                <div className="rowExcerpt">{truncate(t.text, 160)}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* right: AI helper */}
                <div className="card">
                    <div className="cardTitle">AI Draft Helper</div>
                    <div className="row">
                        <label>What should the template say?</label>
                        <textarea
                            className="input"
                            rows={8}
                            placeholder="Describe the goal, details, and tone. Ex: 'Positive note about improvement in reading fluency; include suggestion to read 10 minutes nightly; warm tone.'"
                            value={aiHint}
                            onChange={(e)=>setAiHint(e.target.value)}
                        />
                    </div>
                    <div className="grid2">
                        <div className="row">
                            <label>Topic</label>
                            <select className="input" value={aiTopic} onChange={(e)=>setAiTopic(e.target.value)}>
                                <option>General</option><option>Progress</option><option>Concern</option><option>Positive</option>
                                <option>Attendance</option><option>Behavior</option><option>Assignment</option><option>Meeting</option>
                            </select>
                        </div>
                        <div className="row">
                            <label>Tone</label>
                            <select className="input" value={aiTone} onChange={(e)=>setAiTone(e.target.value as any)}>
                                <option>Neutral</option><option>Warm</option><option>Professional</option><option>Encouraging</option><option>Direct</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid2">
                        <div className="row">
                            <label>Length</label>
                            <select className="input" value={aiLength} onChange={(e)=>setAiLength(e.target.value as any)}>
                                <option>Short</option><option>Medium</option><option>Long</option>
                            </select>
                        </div>
                        <div className="row">
                            <label>&nbsp;</label>
                            <button className="btn btn-primary" onClick={aiDraftIntoEditor} disabled={!aiHint.trim() || aiLoading}>
                                {aiLoading ? 'Drafting…' : 'Draft into Editor'}
                            </button>
                        </div>
                    </div>
                    <div className="help">Tip: You can refine the draft after it opens in the editor, then save.</div>
                </div>
            </div>

            {/* Side editor drawer */}
            {open && editing && (
                <div className="overlay" role="dialog" aria-modal="true">
                    <button className="backdrop" onClick={closeEditor} aria-label="Close editor" />
                    <div className="panel">
                        <div className="head">
                            <div className="title">{editing.id ? 'Edit Template' : 'New Template'}</div>
                            <button className="btn" onClick={closeEditor}>Close</button>
                        </div>

                        <div className="stack-md">
                            <div className="row">
                                <label>Subject (optional)</label>
                                <input
                                    className="input"
                                    value={editing.subject || ''}
                                    onChange={(e)=>setEditing((v)=>v ? ({ ...v, subject: e.target.value }) : v)}
                                    placeholder="Ex: Positive update on reading"
                                />
                                <div className="help">If blank, you can set a subject when composing emails.</div>
                            </div>

                            <div className="row">
                                <label>Body</label>
                                <textarea
                                    className="input"
                                    rows={14}
                                    value={editing.text}
                                    onChange={(e)=>setEditing((v)=>v ? ({ ...v, text: e.target.value }) : v)}
                                    placeholder="Write the message parents will receive…"
                                />
                            </div>

                            <div className="row">
                                <label>Tags (comma or space separated)</label>
                                <input
                                    className="input"
                                    value={(editing.tags || []).join(', ')}
                                    onChange={(e)=>{
                                        const tags = splitTags(e.target.value);
                                        setEditing((v)=>v ? ({ ...v, tags }) : v);
                                    }}
                                    placeholder="topic:positive, short, reading"
                                />
                                <div className="help">Use <b>topic:*</b> to group (e.g., topic:positive, topic:concern). Add any other tags you like.</div>
                            </div>

                            <div className="actions">
                                {editing.id && (
                                    <button className="btn danger" onClick={()=>{ if (confirm('Delete this template?')) { void deleteTemplate(editing.id); closeEditor(); }}}>
                                        Delete
                                    </button>
                                )}
                                <span className="flex" />
                                <button className="btn" onClick={closeEditor}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveEditor} disabled={saving || !editing.text.trim()}>
                                    {saving ? 'Saving…' : 'Save Template'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
                .head { display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; margin-bottom: 12px; }
                .title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 6px; }
                .muted { color: var(--muted); }
                .warn { margin: 8px 0 0; padding: 8px 10px; border: 1px solid #6b7280; border-radius: 10px; color: #eab308; background: rgba(234,179,8,0.08); }

                .toolbar { display:flex; gap:10px; align-items:center; margin: 8px 0 12px; }
                .grid { display:grid; grid-template-columns: 1.2fr .8fr; gap: 12px; }
                @media (max-width: 980px){ .grid { grid-template-columns: 1fr; } }

                .card { border:1px solid var(--border); border-radius:14px; padding:12px; background: rgba(255,255,255,0.03); }
                .cardTitle { font-weight: 700; margin-bottom: 8px; }

                .list { display:flex; flex-direction:column; gap: 10px; }
                .group { border:1px solid var(--border); border-radius:12px; overflow:hidden; background: rgba(255,255,255,0.04); }
                .groupHead { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid var(--border); }
                .groupTitle { font-weight:700; }
                .groupBody { padding:10px; display:flex; flex-direction:column; gap:8px; }

                .rowBtn { text-align:left; border:1px solid var(--border); background: rgba(255,255,255,0.04); border-radius:10px; padding:10px; }
                .rowBtn:hover { background: rgba(255,255,255,0.06); }
                .rowLine { display:flex; align-items:center; justify-content:space-between; gap:8px; }
                .rowSubject { font-weight:600; }
                .rowExcerpt { margin-top: 6px; color: var(--muted); }
                .tags { font-size: 12px; color: var(--muted); }

                .input { width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px 12px; color: inherit; }
                .input.slim { padding: 8px 10px; }
                .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
                .btn-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
                .danger { border-color: rgba(239,68,68,0.6); background: rgba(239,68,68,0.15); }

                .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
                .row { display:flex; flex-direction:column; gap:6px; margin-bottom: 10px; }
                .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
                .help { font-size:12px; color: var(--muted); }

                .actions { display:flex; align-items:center; gap:10px; }
                .flex { flex: 1; }

                /* Right-side drawer */
                .overlay {
                    position: fixed; inset: 0; z-index: 1000;
                    display: flex; justify-content: flex-end; align-items: stretch;
                }
                .backdrop {
                    position: absolute; inset: 0;
                    background: rgba(8,10,22,0.35);
                    backdrop-filter: blur(6px) saturate(0.9);
                    -webkit-backdrop-filter: blur(6px) saturate(0.9);
                }
                .panel {
                    position: relative; margin-left: auto; height: 100vh; width: min(820px, 96vw);
                    background: var(--panel, #0e122b);
                    border-left: 1px solid var(--border, #1f2547);
                    padding: 16px; overflow: auto;
                    box-shadow: -24px 0 60px rgba(0,0,0,0.45);
                    transform: translateX(0);
                    animation: slideIn 200ms ease-out;
                }
                .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
                .title { font-weight: 700; font-size: 18px; }

                @keyframes slideIn {
                    from { transform: translateX(24px); opacity: 0.6; }
                    to   { transform: translateX(0);     opacity: 1; }
                }
            `}</style>
        </div>
    );
}

function truncate(s: string, n = 140) {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
}

function groupByTopic(list: CommentTemplate[]): [string, CommentTemplate[]][] {
    const map = new Map<string, CommentTemplate[]>();
    for (const t of list) {
        const tag = (t.tags || []).find((x) => x.toLowerCase().startsWith('topic:'));
        const topic = tag ? (tag.split(':')[1] || 'General') : 'General';
        const key = topic.charAt(0).toUpperCase() + topic.slice(1);
        map.set(key, [...(map.get(key) || []), t]);
    }
    return Array.from(map.entries()).sort(([a],[b]) => (a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)));
}