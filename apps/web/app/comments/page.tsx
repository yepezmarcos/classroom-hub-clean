'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { api } from '../lib/api';
import CommentBankPanel from './CommentBankPanel';

type Skill = {
  id: string;
  code?: string | null;
  label: string;
  description?: string | null;
  category?: string | null; // stored as the human label in DB
};

type Set = {
  id: string;
  type: 'GENERAL' | 'SUBJECT';
  jurisdiction: string;
  subject?: string | null;
  gradeBand: string;
  name: string;
};

type CommentT = {
  id: string;
  subject?: string | null;
  gradeBand?: string | null;
  text: string;
  tags: string[] | string;
  updatedAt?: string | null;
  skills?: { skill: Skill }[];
  level?: 'E' | 'G' | 'S' | 'NS' | 'NextSteps' | 'END' | null;
  emoji?: string | null;
};

type Settings = {
  jurisdiction?: string;
  board?: string;
  terms?: number;
  subjects?: string[];
  gradeBands?: string[];
  lsCategories?: { id: string; label: string }[];
};

type Level = 'E' | 'G' | 'S' | 'NS' | 'NextSteps' | 'END';
type UICategory = { label: string; slug: string };

// ---------- utils ----------
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
  // Accept string[] OR {label,slug}[]
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'string') {
    return (raw as string[])
      .filter(Boolean)
      .map((label) => ({ label, slug: slugify(label) }));
  }
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'object') {
    return (raw as any[])
      .map((c) => {
        const label = String(c?.label || '').trim();
        const slug = String(c?.slug || slugify(label));
        if (!label) return null;
        return { label, slug };
      })
      .filter(Boolean) as UICategory[];
  }
  return [];
}

export default function CommentBank() {
  const [standardType, setStandardType] = useState<'GENERAL' | 'SUBJECT'>('GENERAL');

  // Settings
  const [settings, setSettings] = useState<Settings | null>(null);

  // Data
  const [rows, setRows] = useState<CommentT[]>([]);
  const [subject, setSubject] = useState('');
  const [gradeBand, setGradeBand] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');

  // Level mapping
  const [levels, setLevels] = useState<Level[]>(['E', 'G', 'S', 'NS', 'NextSteps', 'END']);
  const [levelEmoji, setLevelEmoji] = useState<Record<string, string>>({
    E: '🟢',
    G: '🟡',
    S: '🟠',
    NS: '🔴',
    NextSteps: '🧭',
    END: '🏁',
  });
  const [level, setLevel] = useState<Level | ''>('');

  // Standard sets / skills
  const [sets, setSets] = useState<Set[]>([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillQuery, setSkillQuery] = useState('');

  // Categories for GENERAL sets (Learning Skills)
  const [categories, setCategories] = useState<UICategory[]>([]);
  const [categorySlug, setCategorySlug] = useState(''); // store slug here

  // AI controls
  const [genTone, setGenTone] = useState<'positive' | 'formal' | 'growth' | 'concise'>('positive');
  const [genLength, setGenLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [loadingGen, setLoadingGen] = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);

  const selectedCategory = useMemo(
    () => (categorySlug ? categories.find((c) => c.slug === categorySlug) || null : null),
    [categorySlug, categories],
  );

  // --- Load settings (for subject/gradeBand options + auto-tags)
  useEffect(() => {
    (async () => {
      try {
        const s: Settings = await api('/settings');
        setSettings(s || {});
      } catch {
        setSettings({});
      }
    })();
  }, []);

  // --- Load level mapping (ensures emojis match backend/OG)
  useEffect(() => {
    (async () => {
      try {
        const m = await api('/comments/levels'); // {levels, emoji}
        if (Array.isArray(m?.levels) && m?.emoji) {
          setLevels(m.levels);
          setLevelEmoji(m.emoji);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // --- Load comments
  async function loadComments() {
    const data: CommentT[] = await api('/comments');
    setRows(data || []);
  }
  useEffect(() => {
    void loadComments();
  }, []);

  // --- Load sets on mode change
  async function loadSets() {
    const q = new URLSearchParams({ type: standardType });
    const data: Set[] = await api(`/standards/sets?${q.toString()}`);
    setSets(data || []);
  }
  useEffect(() => {
    setSelectedSet('');
    setSkills([]);
    setCategories([]);
    setCategorySlug('');
    void loadSets();
  }, [standardType]);

  // --- Load skills / categories
  async function loadSkills(setId: string, q?: string, categoryLabel?: string) {
    if (!setId) {
      setSkills([]);
      return;
    }
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (categoryLabel) qs.set('category', categoryLabel); // backend expects label in StandardSkill.category
    const url = `/standards/sets/${setId}/skills${qs.toString() ? `?${qs.toString()}` : ''}`;
    const data: Skill[] = await api(url);
    setSkills(data || []);
  }

  async function loadCategories(setId: string) {
    if (!setId) {
      setCategories([]);
      return;
    }
    const raw = await api(`/standards/sets/${setId}/categories`);
    setCategories(normalizeCategories(raw));
  }

  // --- Insert token into textarea
  function insertToken(token: string) {
    const ta = taRef.current;
    if (!ta) {
      setText((v) => v + token);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  // --- Save / Delete
  async function add() {
    if (!text.trim()) return;

    // base tags
    const rawTags = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const base = standardType === 'GENERAL' ? 'learning' : 'subject';
    const jur = (settings?.jurisdiction || '').toLowerCase().trim();

    const computed = new Set<string>([base, ...(jur ? [jur] : [])]);

    // add category tag if chosen
    if (selectedCategory) {
      computed.add(`category:${selectedCategory.slug}`);
      // if this looks like Ontario LS, add ls:<Label> to help old UIs
      const isOntario = jur === 'ontario' || (settings?.board || '').toLowerCase().includes('district school board');
      if (isOntario) computed.add(`ls:${selectedCategory.label}`);
    }

    // merge raw tags
    for (const t of rawTags) computed.add(t);

    // payload
    const payload: any = {
      subject: standardType === 'SUBJECT' ? subject || undefined : undefined,
      gradeBand: gradeBand || undefined,
      text: text.trim(),
      tags: Array.from(computed),
      skillIds: selectedSkills, // backend links CommentTemplateSkill rows
      level: (level as Level) || undefined,
      // send category label explicitly so backend tags category:<slug> and wires generator
      category: selectedCategory?.label || undefined,
    };

    try {
      await api('/comments', { method: 'POST', body: JSON.stringify(payload) });
    } catch {
      // fallback without skillIds
      const { skillIds, ...fallback } = payload;
      await api('/comments', { method: 'POST', body: JSON.stringify(fallback) });
    }

    // reset and reload
    setSubject('');
    setGradeBand('');
    setText('');
    setTags('');
    setSelectedSkills([]);
    setLevel('');
    await loadComments();
  }

  async function del(id: string) {
    await api(`/comments/${id}`, { method: 'DELETE' });
    await loadComments();
  }

  // --- Seeders
  async function seedLearning() {
    const set = await api('/standards/seed-learning-skills', { method: 'POST', body: JSON.stringify({}) });
    await loadSets();
    setSelectedSet(set.id);
    await loadSkills(set.id);
    await loadCategories(set.id);
  }
  async function seedSubject() {
    const set = await api('/standards/seed-subject-sample', { method: 'POST', body: JSON.stringify({}) });
    await loadSets();
    setSelectedSet(set.id);
    await loadSkills(set.id);
  }

  // --- Backfill existing comments with level/emoji
  async function backfillLevels() {
    const r = await api('/comments/backfill-levels', { method: 'POST', body: JSON.stringify({}) });
    alert(`Backfill done: updated ${r?.updated || 0} / ${r?.total || 0} (skipped ${r?.skipped || 0}).`);
    await loadComments();
  }

  // --- AI Generate (level-aware)
  async function generateAI() {
    setLoadingGen(true);
    try {
      const res = await api('/comments/generate', {
        method: 'POST',
        body: JSON.stringify({
          subject: standardType === 'SUBJECT' ? subject || undefined : undefined,
          gradeBand: gradeBand || undefined,
          skillIds: selectedSkills,
          tone: genTone,
          length: genLength,
          placeholders: PLACEHOLDER_BUTTONS,
          level: (level as Level) || undefined,
        }),
      });
      setText(res?.text || '');
    } finally {
      setLoadingGen(false);
    }
  }

  // --- Debounced suggestions (include placeholders)
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try {
        setSuggestBusy(true);
        const res = await api('/ai/suggest/comments', {
          method: 'POST',
          body: JSON.stringify({
            context: 'comments',
            partialText: text,
            subject: standardType === 'SUBJECT' ? subject || null : null,
            gradeBand: gradeBand || null,
            standardType,
            setId: selectedSet || undefined,
            category: selectedCategory?.label || null,
            skillIds: selectedSkills,
            tone: genTone,
            placeholders: PLACEHOLDER_BUTTONS,
          }),
        });
        setSuggestions(res?.suggestions || []);
      } finally {
        setSuggestBusy(false);
      }
    }, 600);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, subject, gradeBand, standardType, selectedSet, categorySlug, selectedSkills, genTone]);

  // --- Helpers for selects
  const subjectOptions = (settings?.subjects || []).filter(Boolean);
  const bandOptions = (settings?.gradeBands || []).filter(Boolean);
  const showSubjectField = standardType === 'SUBJECT';

  const setLabel = (s: Set) =>
    `${s.jurisdiction} ${s.type === 'SUBJECT' ? `${s.subject || ''} ` : ''}${s.gradeBand} — ${s.name}`;

  return (
    <div className="card" style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>🗂️ Comment Bank</h2>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="toggle">
          <input
            type="radio"
            name="mode"
            checked={standardType === 'GENERAL'}
            onChange={() => setStandardType('GENERAL')}
          />{' '}
          Elementary Learning Skills
        </label>
        <label className="toggle">
          <input
            type="radio"
            name="mode"
            checked={standardType === 'SUBJECT'}
            onChange={() => setStandardType('SUBJECT')}
          />{' '}
          Subject Standards
        </label>
      </div>

      {/* Meta fields + Level */}
      <div
        style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: showSubjectField ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
        }}
      >
        {showSubjectField &&
          (subjectOptions.length ? (
            <div className="chip">
              <span>Subject</span>
              <select
                value={subject || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__custom__') setSubject('');
                  else setSubject(v);
                }}
              >
                <option value="">—</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="__custom__">Custom…</option>
              </select>
            </div>
          ) : (
            <input
              placeholder="Subject (e.g., ELA, Math)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          ))}

        {bandOptions.length ? (
          <div className="chip">
            <span>Grade band</span>
            <select
              value={gradeBand || ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__custom__') setGradeBand('');
                else setGradeBand(v);
              }}
            >
              <option value="">—</option>
              {bandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
          </div>
        ) : (
          <input
            placeholder="Grade band (e.g., K–2, 3–5, 6–8, 9–12)"
            value={gradeBand}
            onChange={(e) => setGradeBand(e.target.value)}
          />
        )}

        {/* Level */}
        <div className="chip">
          <span>Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value as Level | '')}>
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {levelEmoji?.[l] ? `${levelEmoji[l]} ` : ''} {l}
              </option>
            ))}
          </select>
        </div>

        {/* Freeform tags */}
        <input
          placeholder={`Tags (comma-separated)${
            settings?.jurisdiction ? ` — auto adds '${(settings.jurisdiction || '').toLowerCase()}'` : ''
          }`}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      {/* Standards selection */}
      <div className="card" style={{ background: 'transparent', padding: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedSet}
            onChange={async (e) => {
              const id = e.target.value;
              setSelectedSet(id);
              setSkillQuery('');
              setCategorySlug('');
              await loadSkills(id);
              if (standardType === 'GENERAL') await loadCategories(id);
            }}
          >
            <option value="">— Select Standard Set —</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {setLabel(s)}
              </option>
            ))}
          </select>

          {/* Category select (works like Level) */}
          {standardType === 'GENERAL' && (
            <>
              <select
                value={categorySlug}
                onChange={async (e) => {
                  const slug = e.target.value;
                  setCategorySlug(slug);
                  const catLabel = categories.find((c) => c.slug === slug)?.label;
                  await loadSkills(selectedSet, skillQuery, catLabel || undefined);
                }}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button onClick={() => void seedLearning()}>Seed sample (Learning Skills)</button>
            </>
          )}

          {standardType === 'SUBJECT' && (
            <button onClick={() => void seedSubject()}>Seed sample (Subject ELA)</button>
          )}

          <input
            placeholder="Search skills..."
            value={skillQuery}
            onChange={(e) => setSkillQuery(e.target.value)}
          />
          <button
            onClick={() => {
              const label = selectedCategory?.label || undefined;
              void loadSkills(selectedSet, skillQuery, label);
            }}
          >
            Search
          </button>

          <button onClick={() => void backfillLevels()} title="Add levels to existing comments that lack them">
            Backfill levels
          </button>
        </div>

        {skills.length > 0 && (
          <div className="skills-box">
            {skills.map((sk) => {
              const checked = selectedSkills.includes(sk.id);
              return (
                <label key={sk.id} className="skill-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedSkills((prev) => (checked ? prev.filter((id) => id !== sk.id) : [...prev, sk.id]))
                    }
                  />
                  <span className="skill-text">
                    <strong>{sk.code ? `${sk.code} ` : ''}{sk.label}</strong>
                    {sk.category ? ` — (${sk.category})` : ''}
                    {sk.description ? ` — ${sk.description}` : ''}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Placeholder toolbar */}
      <div className="toolbar">
        {PLACEHOLDER_BUTTONS.map((p) => (
          <button key={p} className="token" onClick={() => insertToken(p)} title="Insert placeholder">
            {p}
          </button>
        ))}
      </div>

      {/* Text area + suggestions */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 320px' }}>
        <textarea
          ref={taRef}
          placeholder="Comment text (use placeholders from the toolbar)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="ta"
        />
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Suggestions</h3>
            {suggestBusy && <span style={{ fontSize: 12, color: 'var(--muted)' }}>thinking…</span>}
          </div>
          <div className="suggs">
            {suggestions.length === 0 && <div style={{ color: 'var(--muted)' }}>Start typing to see AI suggestions.</div>}
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => insertToken((text ? ' ' : '') + s)} className="sugg">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" onClick={() => void add()}>
          Save comment
        </button>
        <span>AI: </span>
        <select value={genTone} onChange={(e) => setGenTone(e.target.value as any)}>
          <option value="positive">Positive</option>
          <option value="growth">Growth</option>
          <option value="formal">Formal</option>
          <option value="concise">Concise</option>
        </select>
        <select value={genLength} onChange={(e) => setGenLength(e.target.value as any)}>
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
        <button onClick={() => void generateAI()} disabled={loadingGen}>
          {loadingGen ? 'Generating…' : 'AI Generate'}
        </button>
      </div>

      {/* Saved comments */}
      <div className="card" style={{ marginTop: 8 }}>
        <h3>Saved comments</h3>
        {rows.length === 0 && <p>No comments yet.</p>}
        {rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Lvl</th>
                <th>Subject</th>
                <th>Grade band</th>
                <th>Skills</th>
                <th>Tags</th>
                <th>Text</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.level ? <span title={r.level}>{(r.emoji ?? (r.level ? levelEmoji[r.level] : '•')) || '•'} {r.level}</span> : '—'}
                  </td>
                  <td>{r.subject || ''}</td>
                  <td>{r.gradeBand || ''}</td>
                  <td style={{ maxWidth: 300 }}>
                    {r.skills?.length
                      ? r.skills.map((s) => (s.skill.code ? `${s.skill.code} ${s.skill.label}` : s.skill.label)).join(', ')
                      : '—'}
                  </td>
                  <td>
                    {Array.isArray(r.tags)
                      ? r.tags.join(', ')
                      : (typeof r.tags === 'string' ? r.tags : '')}
                  </td>
                  <td style={{ maxWidth: 480, whiteSpace: 'pre-wrap' }}>{r.text}</td>
                  <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
                  <td>
                    <button onClick={() => void del(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .toggle { cursor: pointer; }
        .chip { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--border); border-radius:9999px; background:rgba(255,255,255,.03); }
        .skills-box { margin-top:10px; max-height:180px; overflow:auto; border:1px solid var(--border); border-radius:12px; padding:8px; }
        .skill-row { display:flex; gap:8px; align-items:center; padding:4px 0; }
        .skill-text { font-size: 13px; }
        .toolbar { display:flex; flex-wrap:wrap; gap:8px; }
        .token, .sugg { text-align:left; border:1px solid var(--border); background: rgba(255,255,255,.05); padding:8px 10px; border-radius:10px; transition: transform .06s ease, background .2s ease; }
        .token:hover, .sugg:hover { transform: translateY(-1px); background: rgba(255,255,255,.08); }
        .ta { resize: vertical; padding: 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); color: var(--text); transition: box-shadow .15s ease; }
        .ta:focus { box-shadow: 0 0 0 2px rgba(99,102,241,0.35); outline: none; }
        .suggs { display:grid; gap:8px; margin-top:8px; }
      `}</style>
    </div>
  );
}

const PLACEHOLDER_BUTTONS = [
  '{{student_first}}','{{student_last}}','{{he_she}}','{{him_her}}','{{his_her}}',
  '{{they}}','{{them}}','{{their}}','{{subject}}','{{class_name}}','{{teacher_name}}',
  '{{term}}','{{strength}}','{{next_step}}',
];