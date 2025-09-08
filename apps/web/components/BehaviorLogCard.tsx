'use client';

import { useMemo, useState } from 'react';
import { api } from '../lib/api';

type Note = {
    id: string;
    body: string;
    tags: string[];
    createdAt: string;
    author?: { name?: string | null; email?: string | null };
};

type Props = {
    studentId: string;
    /** pass the student's notes so this card can filter behavior notes */
    notes: Note[];
    /** call to refresh parent page after add/delete (typically the page's load()) */
    onUpdated?: () => void;
};

type Kind = 'positive' | 'neutral' | 'concern';

const KINDS: { id: Kind; label: string; emoji: string }[] = [
    { id: 'positive', label: 'Positive', emoji: '✅' },
    { id: 'neutral',  label: 'Neutral',  emoji: '📝' },
    { id: 'concern',  label: 'Concern',  emoji: '⚠️' },
];

export default function BehaviorLogCard({ studentId, notes, onUpdated }: Props) {
    const [kind, setKind] = useState<Kind>('positive');
    const [body, setBody] = useState('');
    const [filter, setFilter] = useState<Kind | 'all'>('all');

    const behaviorNotes = useMemo(() => {
        const all = (notes || []).filter(n =>
            (n.tags || []).some(t => t.toLowerCase() === 'behavior' || t.toLowerCase().startsWith('behavior:'))
        );
        if (filter === 'all') return all.sort((a,b)=>new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return all
            .filter(n => (n.tags || []).map(t=>t.toLowerCase()).includes(`behavior:${filter}`))
            .sort((a,b)=>new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [notes, filter]);

    const counts = useMemo(() => {
        const c = { positive: 0, neutral: 0, concern: 0 } as Record<Kind, number>;
        for (const n of notes || []) {
            const tl = (n.tags || []).map(t=>t.toLowerCase());
            if (tl.includes('behavior:positive')) c.positive++;
            if (tl.includes('behavior:neutral'))  c.neutral++;
            if (tl.includes('behavior:concern'))  c.concern++;
        }
        return c;
    }, [notes]);

    async function addBehavior() {
        const text = (body || '').trim();
        if (!text) return;
        try {
            await api(`/students/${studentId}/notes`, {
                method: 'POST',
                body: JSON.stringify({
                    body: text,
                    tags: ['comment', 'behavior', `behavior:${kind}`],
                }),
            });
            setBody('');
            if (onUpdated) onUpdated();
        } catch {
            alert('Could not add behavior note.');
        }
    }

    return (
        <div className="card">
            <div className="flex-between">
                <span className="title">🎯 Behavior Log</span>
                <div className="chip-row">
                    <button
                        className={`btn bchip ${filter==='all' ? 'on':''}`}
                        onClick={()=>setFilter('all')}
                    >All</button>
                    {KINDS.map(k => (
                        <button
                            key={k.id}
                            className={`btn bchip ${filter===k.id ? 'on':''} ${k.id}`}
                            onClick={()=>setFilter(k.id)}
                            title={`${k.label} (${counts[k.id]})`}
                        >
                            {k.emoji} {k.label} {counts[k.id] ? `(${counts[k.id]})` : ''}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid2 mt-2">
                <div>
                    <div className="label">Type</div>
                    <div className="chip-row">
                        {KINDS.map(k => (
                            <button
                                key={k.id}
                                className={`btn bchip ${kind===k.id ? 'on':''} ${k.id}`}
                                onClick={()=>setKind(k.id)}
                            >
                                {k.emoji} {k.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="label">New entry</div>
                    <div className="row">
                        <input
                            className="input"
                            placeholder="Brief description…"
                            value={body}
                            onChange={e=>setBody(e.target.value)}
                            onKeyDown={e=>{
                                if (e.key === 'Enter' && body.trim()) {
                                    e.preventDefault();
                                    void addBehavior();
                                }
                            }}
                        />
                        <button className="btn btn-primary" onClick={addBehavior} disabled={!body.trim()}>Add</button>
                    </div>
                </div>
            </div>

            <div className="list mt-2">
                {behaviorNotes.length === 0 && <div className="muted">No behavior entries yet.</div>}
                {behaviorNotes.map(n => {
                    const tl = (n.tags || []).map(t=>t.toLowerCase());
                    const k: Kind | null =
                        tl.includes('behavior:positive') ? 'positive' :
                            tl.includes('behavior:concern')  ? 'concern'  :
                                tl.includes('behavior:neutral')  ? 'neutral'  : null;
                    return (
                        <div key={n.id} className="item">
                            <span className={`kdot ${k||'neutral'}`} />
                            <div className="content">
                                <div className="meta">
                  <span className={`badge ${k||'neutral'}`}>
                    {k==='positive'?'Positive':k==='concern'?'Concern':'Neutral'}
                  </span>
                                    <span className="when">{new Date(n.createdAt).toLocaleString()}</span>
                                    <span className="author">{n.author?.name || n.author?.email || ''}</span>
                                </div>
                                <div className="body">{n.body}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
        .title { font-size: 16px; font-weight: 700; }
        .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .row { display:flex; gap:10px; }
        .chip-row { display:flex; gap:8px; flex-wrap:wrap; }
        .bchip { padding:6px 10px; border-radius: 9999px; }
        .bchip.positive.on { background: rgba(30,180,90,0.18); border-color: rgba(30,180,90,0.55); }
        .bchip.neutral.on  { background: rgba(140,140,160,0.18); border-color: rgba(140,140,160,0.55); }
        .bchip.concern.on  { background: rgba(230,80,60,0.18);  border-color: rgba(230,80,60,0.55); }
        .list { display:flex; flex-direction:column; gap:10px; }
        .item { display:flex; gap:10px; border:1px solid var(--border); background: rgba(255,255,255,0.04); border-radius:12px; padding:10px; }
        .kdot { width:10px; height:10px; border-radius:9999px; margin-top:6px; }
        .kdot.positive { background:#27c277; }
        .kdot.neutral  { background:#8d93a5; }
        .kdot.concern  { background:#ef5b4d; }
        .meta { display:flex; gap:8px; flex-wrap:wrap; font-size:12px; color: var(--muted); align-items:center; }
        .badge { padding:2px 8px; border-radius:9999px; border:1px solid var(--border); font-size:11px; }
        .badge.positive { background: rgba(30,180,90,0.15); }
        .badge.neutral  { background: rgba(140,140,160,0.12); }
        .badge.concern  { background: rgba(230,80,60,0.15); }
        .when { opacity:.9; }
        .author { opacity:.75; }
        .body { white-space:pre-wrap; line-height:1.42; margin-top:4px; }
        .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        @media (max-width: 820px) { .grid2 { grid-template-columns: 1fr; } }
        .input { width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px 12px; color:inherit; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 12px; border-radius:12px; }
        .btn-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
        .mt-2 { margin-top: 10px; }
      `}</style>
        </div>
    );
}