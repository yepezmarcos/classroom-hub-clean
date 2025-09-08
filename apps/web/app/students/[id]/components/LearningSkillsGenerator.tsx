'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/app/lib/api';

type LsCat = { id: string; label: string };
type LevelsMap = { levels: Array<'E'|'G'|'S'|'NS'|'NextSteps'|'END'>; emoji: Record<string, string> };

const PLACEHOLDERS = [
  '{{student_first}}','{{student_last}}','{{he_she}}','{{him_her}}','{{his_her}}',
  '{{they}}','{{them}}','{{their}}','{{term}}','{{strength}}','{{next_step}}',
];

export default function LearningSkillsGenerator({
  studentId,
  onAddComment,
}: {
  studentId: string;
  onAddComment?: (payload: { text: string; level?: string | null; category?: string | null }) => void;
}) {
  const [cats, setCats] = useState<LsCat[]>([]);
  const [levels, setLevels] = useState<LevelsMap | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [level, setLevel] = useState<LevelsMap['levels'][number] | ''>('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  // fetch categories & levels
  async function loadSchema() {
    const ls = await api('/learning-skills'); // {categories, version, updatedAt}
    setCats(ls?.categories || []);
  }
  async function loadLevels() {
    try {
      const m = await api('/comments/levels');
      setLevels(m);
    } catch {
      setLevels({ levels: ['E','G','S','NS','NextSteps','END'], emoji: { E:'🟢', G:'🟡', S:'🟠', NS:'🔴', NextSteps:'🧭', END:'🏁' } });
    }
  }

  useEffect(() => { void loadSchema(); void loadLevels(); }, []);

  // listen for settings changes from Settings page
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'settings:changed') {
        void loadSchema();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const emoji = useMemo(() => (levels?.emoji?.[String(level)] || ''), [levels, level]);

  async function generate() {
    setBusy(true);
    try {
      const res = await api('/comments/generate', {
        method: 'POST',
        body: JSON.stringify({
          subject: null,
          gradeBand: null,
          tone: 'positive',
          length: 'medium',
          placeholders: PLACEHOLDERS,
          level: level || null,
        }),
      });
      setText(res?.text || '');
    } finally { setBusy(false); }
  }

  async function save() {
    if (!text.trim()) return;
    await api('/comments', {
      method: 'POST',
      body: JSON.stringify({
        subject: null,
        gradeBand: null,
        text: text.trim(),
        tags: Array.from(new Set(['learning', ...(selectedCat ? [`ls:${selectedCat}`] : [])])),
        level: level || undefined,
      }),
    });
    onAddComment?.({ text: text.trim(), level: level || null, category: selectedCat || null });
    setText('');
  }

  return (
    <div className="card" style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <div className="chip">
          <span>Category</span>
          <select value={selectedCat} onChange={e=>setSelectedCat(e.target.value)}>
            <option value="">—</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div className="chip">
          <span>Level</span>
          <select value={level} onChange={e=>setLevel(e.target.value as any)}>
            <option value="">—</option>
            {(levels?.levels || ['E','G','S','NS','NextSteps','END']).map(l => (
              <option key={l} value={l}>
                {levels?.emoji?.[l] ? `${levels.emoji[l]} ` : ''}{l}
              </option>
            ))}
          </select>
        </div>

        <button className="btn" onClick={()=>void generate()} disabled={busy}>
          {busy ? 'Generating…' : 'AI Generate'}
        </button>
      </div>

      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        rows={4}
        className="ta"
        placeholder="Write or generate a learning skills comment…"
      />

      <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ opacity: emoji ? 1 : .6 }}>
          {emoji ? `Selected: ${emoji} ${level}` : 'Select a level'}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={()=>setText('')}>Clear</button>
          <button className="btn btn-primary" onClick={()=>void save()} disabled={!text.trim()}>Save to Comment Bank</button>
        </div>
      </div>

      <style jsx>{`
        .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:9999px;background:rgba(255,255,255,.03)}
        .ta{resize:vertical;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text)}
        .btn{border:1px solid var(--border);background:rgba(255,255,255,.05);padding:10px 12px;border-radius:10px}
        .btn-primary{background:rgba(99,102,241,.22);border-color:rgba(99,102,241,.55)}
      `}</style>
    </div>
  );
}