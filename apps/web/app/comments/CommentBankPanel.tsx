'use client';

import * as React from 'react';

type Level = 'E' | 'G' | 'S' | 'NS' | 'NextSteps' | 'END';
type Category = { id: string; label: string };
type CommentRow = { id?: string; text: string };

async function getJSON<T>(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return (await r.json()) as T;
}
async function postJSON<T>(url: string, body: any) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    let msg = `POST ${url} → ${r.status}`;
    try {
      const j = JSON.parse(text);
      msg = (j && (j.message || j.error)) || msg;
    } catch {}
    throw new Error(msg);
  }
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}

export default function CommentBankPanel() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [levels, setLevels] = React.useState<Level[]>([]);
  const [levelEmoji, setLevelEmoji] = React.useState<Record<string,string>>({});
  const [selectedSkill, setSelectedSkill] = React.useState<string>('');
  const [selectedLevel, setSelectedLevel] = React.useState<Level | ''>('');
  const [q, setQ] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<CommentRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [custom, setCustom] = React.useState('');

  // Load categories (from Settings) and levels map on mount
  React.useEffect(() => {
    (async () => {
      try {
        const s = await getJSON<{ lsCategories?: Category[] }>('/api/proxy/settings');
        const cats = Array.isArray(s?.lsCategories) ? s.lsCategories : [];
        setCategories(cats);
        // pick first by default
        if (cats.length && !selectedSkill) setSelectedSkill(cats[0].id);
      } catch (e) {
        console.error('settings load failed', e);
      }
      try {
        const m = await getJSON<{ levels: Level[]; emoji: Record<string,string> }>('/api/proxy/comments/levels');
        setLevels(m.levels || []);
        setLevelEmoji(m.emoji || {});
      } catch (e) {
        console.error('levels load failed', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch suggestions whenever skill/level/q changes (debounced on q)
  React.useEffect(() => {
    const t = setTimeout(async () => {
      if (!selectedSkill) { setSuggestions([]); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('skill', selectedSkill);
        if (selectedLevel) params.set('level', selectedLevel);
        if (q.trim()) params.set('q', q.trim());
        const rows = await getJSON<CommentRow[]>(
          `/api/proxy/comments/by-skill?${params.toString()}`
        );
        setSuggestions(rows || []);
      } catch (e) {
        console.error('suggestions failed', e);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [selectedSkill, selectedLevel, q]);

  function lvlBadge(lv?: Level | '') {
    if (!lv) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
        <span>{levelEmoji[lv] || '•'}</span>
        <span>{lv}</span>
      </span>
    );
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard');
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      alert('Copied to clipboard');
    }
  }

  async function saveCustom() {
    if (!custom.trim()) { alert('Enter comment text'); return; }
    if (!selectedSkill) { alert('Pick a category'); return; }
    setSaving(true);
    try {
      await postJSON('/api/proxy/comments', {
        text: custom.trim(),
        skill: selectedSkill,
        level: selectedLevel || undefined,
      });
      setCustom('');
      // refresh list so it appears immediately
      const params = new URLSearchParams();
      params.set('skill', selectedSkill);
      if (selectedLevel) params.set('level', selectedLevel);
      const rows = await getJSON<CommentRow[]>(
        `/api/proxy/comments/by-skill?${params.toString()}`
      );
      setSuggestions(rows || []);
      alert('Saved to bank ✅');
    } catch (e: any) {
      alert(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveCopy(text: string) {
    if (!selectedSkill) { alert('Pick a category'); return; }
    try {
      await postJSON('/api/proxy/comments', {
        text,
        skill: selectedSkill,
        level: selectedLevel || undefined,
      });
      alert('Copied into your bank ✅');
    } catch (e: any) {
      alert(e?.message || 'Save failed');
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Comment Bank</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Category</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = c.id === selectedSkill;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedSkill(c.id)}
                  className={`px-3 py-1 rounded-full border text-sm ${active ? 'bg-black text-white' : 'bg-white'}`}
                  title={c.label}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Level */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Level</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedLevel('')}
              className={`px-2 py-1 rounded-full border text-sm ${!selectedLevel ? 'bg-black text-white' : 'bg-white'}`}
            >
              All
            </button>
            {levels.map((lv) => {
              const active = lv === selectedLevel;
              return (
                <button
                  key={lv}
                  onClick={() => setSelectedLevel(lv)}
                  className={`px-2 py-1 rounded-full border text-sm ${active ? 'bg-black text-white' : 'bg-white'}`}
                  title={lv}
                >
                  <span className="mr-1">{levelEmoji[lv] || '•'}</span>{lv}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="ml-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search text…"
            className="rounded-md border px-3 py-1 text-sm w-60"
          />
        </div>
      </div>

      {/* Add custom */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="text-sm font-medium">Add custom comment</div>
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={3}
          className="w-full rounded-md border px-3 py-2"
          placeholder="Write your comment. You can use placeholders like {{student_first}}."
        />
        <div className="flex gap-2">
          <button
            onClick={saveCustom}
            disabled={saving || !custom.trim() || !selectedSkill}
            className="px-3 py-1.5 rounded-md bg-black text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save to bank'}
          </button>
        </div>
        <div className="text-xs text-gray-500">
          Saved comments are tagged with the selected Category and (optional) Level.
        </div>
      </div>

      {/* Suggestions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {loading ? 'Loading suggestions…' : `Suggestions: ${suggestions.length}`}
        </div>
      </div>

      <div className="grid gap-3">
        {suggestions.map((row, idx) => (
          <div key={row.id ?? `s-${idx}`} className="rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 whitespace-pre-wrap leading-relaxed">{row.text}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(row.text)}
                  className="px-3 py-1.5 rounded-md border text-sm"
                >
                  Insert
                </button>
                <button
                  onClick={() => saveCopy(row.text)}
                  className="px-3 py-1.5 rounded-md bg-black text-white text-sm"
                >
                  Save copy
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && !suggestions.length && (
          <div className="text-sm text-gray-500">No suggestions. Try a different category/level or search.</div>
        )}
      </div>
    </div>
  );
}