'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

type Level = 'E' | 'G' | 'S' | 'NS' | 'NextSteps' | 'END';
type Set = { id: string; type: 'GENERAL' | 'SUBJECT'; jurisdiction: string; subject?: string|null; gradeBand: string; name: string; };

type UICategory = { label: string; slug: string };
type CommentT = {
  id: string;
  text: string;
  tags: string[] | string;
  level?: Level | null;
  emoji?: string | null;
  updatedAt?: string | null;
};

function slugify(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function normalizeCategories(raw: any): UICategory[] {
  if (!raw) return [];
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'string') {
    return (raw as string[]).filter(Boolean).map(label => ({ label, slug: slugify(label) }));
  }
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'object') {
    return (raw as any[]).map(c => {
      const label = String(c?.label || '').trim();
      const slug = String(c?.slug || slugify(label));
      return label ? { label, slug } : null;
    }).filter(Boolean) as UICategory[];
  }
  return [];
}

export default function CommentGenerator(props: {
  onInsert: (text: string) => void; // parent (e.g., student note editor) will append/insert this text
}) {
  const [levels, setLevels] = useState<Level[]>(['E','G','S','NS','NextSteps','END']);
  const [emoji, setEmoji] = useState<Record<string,string>>({E:'🟢',G:'🟡',S:'🟠',NS:'🔴',NextSteps:'🧭',END:'🏁'});
  const [activeLevel, setActiveLevel] = useState<Level | ''>('');

  const [sets, setSets] = useState<Set[]>([]);
  const [setId, setSetId] = useState('');
  const [categories, setCategories] = useState<UICategory[]>([]);
  const [catSlug, setCatSlug] = useState('');

  const [suggestions, setSuggestions] = useState<CommentT[]>([]);
  const selectedCategory = useMemo(() => categories.find(c => c.slug === catSlug) || null, [categories, catSlug]);

  // load level mapping
  useEffect(() => {
    (async () => {
      try {
        const m = await api('/comments/levels');
        if (Array.isArray(m?.levels) && m?.emoji) {
          setLevels(m.levels);
          setEmoji(m.emoji);
        }
      } catch {}
    })();
  }, []);

  // load GENERAL sets, choose most recent
  useEffect(() => {
    (async () => {
      const list: Set[] = await api('/standards/sets?type=GENERAL');
      setSets(list || []);
      if (list && list.length) setSetId(list[0].id);
    })();
  }, []);

  // load categories when set changes
  useEffect(() => {
    (async () => {
      if (!setId) { setCategories([]); setCatSlug(''); return; }
      const raw = await api(`/standards/sets/${setId}/categories`);
      const cats = normalizeCategories(raw);
      setCategories(cats);
      if (cats.length && !catSlug) setCatSlug(cats[0].slug);
    })();
  }, [setId]);

  // load suggestions when category or level changes
  useEffect(() => {
    (async () => {
      if (!catSlug) { setSuggestions([]); return; }
      const qs = new URLSearchParams({ skill: catSlug });
      if (activeLevel) qs.set('level', activeLevel);
      const rows: CommentT[] = await api(`/comments/by-skill?${qs.toString()}`);
      setSuggestions(rows || []);
    })();
  }, [catSlug, activeLevel]);

  async function addToBank(text: string) {
    if (!text.trim()) return;
    const res = await api('/comments', {
      method: 'POST',
      body: JSON.stringify({
        text: text.trim(),
        tags: [`category:${catSlug}`, 'learning'],
        level: activeLevel || undefined,
      }),
    });
    return res;
  }

  return (
    <div className="cg card" style={{ display:'grid', gap:12 }}>
      <h3 style={{ margin: 0 }}>💬 Comment Generator</h3>

      {/* Set + Category */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <select value={setId} onChange={e=>setSetId(e.target.value)}>
          {sets.map(s => (
            <option key={s.id} value={s.id}>
              {s.jurisdiction} {s.gradeBand} — {s.name}
            </option>
          ))}
        </select>
        <select value={catSlug} onChange={e=>setCatSlug(e.target.value)}>
          {categories.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
      </div>

      {/* Level chips */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {levels.map(l => (
          <button
            key={l}
            onClick={()=>setActiveLevel(prev => prev===l ? '' : l)}
            className={`lvl ${activeLevel===l ? 'on' : ''}`}
            title={l}
          >
            <span style={{ marginRight:6 }}>{emoji?.[l] || '•'}</span>{l}
          </button>
        ))}
        <button onClick={()=>setActiveLevel('')} className={`lvl ${activeLevel==='' ? 'on' : ''}`}>Any level</button>
      </div>

      {/* Suggestions */}
      <div className="sbox">
        {(!suggestions || !suggestions.length) && (
          <div style={{ color:'var(--muted)' }}>No suggestions yet. Pick a category and (optionally) a level.</div>
        )}
        {suggestions && suggestions.length > 0 && suggestions.map((c) => (
          <div key={c.id} className="row">
            <div className="text">
              {c.level ? <span title={c.level} style={{ marginRight:6 }}>{c.emoji ?? (c.level ? emoji[c.level] : '•')}</span> : null}
              {c.text}
            </div>
            <div className="actions">
              <button onClick={()=>props.onInsert(c.text)}>Insert</button>
              <button onClick={()=>void addToBank(c.text)}>Add to bank</button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .lvl {
          border:1px solid var(--border);
          background: rgba(255,255,255,.03);
          padding:6px 10px;
          border-radius:9999px;
          font-size: 13px;
        }
        .lvl.on { background: rgba(255,255,255,.08); }
        .sbox { display:grid; gap:8px; }
        .row { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:8px; border:1px solid var(--border); border-radius:10px; }
        .text { flex:1; white-space:pre-wrap; }
        .actions { display:flex; gap:8px; }
      `}</style>
    </div>
  );
}