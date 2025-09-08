'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type LsCat = { id: string; label: string };

type Settings = {
  jurisdiction?: string | null;
  board?: string | null;
  terms?: number | null;
  subjects?: string[];
  gradeBands?: string[];
  lsCategories?: LsCat[];
};

type OptionsResp = {
  countries: string[];
  stateProvinces: string[];
  boards: { id?: string; name: string; city?: string; url?: string; score?: number }[];
  suggestedJurisdiction: string | null;
  suggestedLsCategories: LsCat[];
};

type AiBoard = { name: string; url?: string | null; score?: number };

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<Settings>({ terms: 3, subjects: [], gradeBands: [], lsCategories: [] });

  // GEO — start empty for user specificity (no more "Toronto" default)
  const [country, setCountry] = useState('Canada');
  const [region, setRegion] = useState(''); // filled by options
  const [city, setCity] = useState(''); // user types their city

  const [opts, setOpts] = useState<OptionsResp | null>(null);

  // Board
  const [boardHits, setBoardHits] = useState<AiBoard[]>([]);
  const [selectedBoardName, setSelectedBoardName] = useState<string>('');

  // LS categories
  const [lsCats, setLsCats] = useState<LsCat[]>([]);

  // Terms / subjects / bands
  const [terms, setTerms] = useState<number>(3);
  const [termLabels, setTermLabels] = useState<string[]>(['T1', 'T2', 'T3']);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [gradeBands, setGradeBands] = useState<string[]>([]);
  const [newBand, setNewBand] = useState('');

  // Curriculum fetch
  const [gradesForImport, setGradesForImport] = useState<string[]>(['K-8']);
  const [curriculumLog, setCurriculumLog] = useState<string>('');

  // Load existing settings
  async function load() {
    setLoading(true);
    try {
      const s: Settings = await api('/settings');
      setSettings(s || {});
      setTerms(Number(s?.terms ?? 3));
      setSubjects(s?.subjects || []);
      setGradeBands(s?.gradeBands || []);
      setLsCats((s?.lsCategories as LsCat[]) || []);
      setTermLabels(Array.from({ length: Number(s?.terms ?? 3) }, (_, i) => `T${i + 1}`));

      // keep selected board in local UI
      setSelectedBoardName(s?.board || '');

      // heuristic region from jurisdiction
      const jur = (s?.jurisdiction || '').toLowerCase();
      if (jur === 'ontario') {
        setCountry('Canada');
        setRegion('Ontario');
      } else if (jur.startsWith('usa')) {
        setCountry('United States');
      } else if (jur.startsWith('uk')) {
        setCountry('United Kingdom');
      } else if (jur.startsWith('australia')) {
        setCountry('Australia');
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  // Fetch basic options whenever country/region/city changes (debounced for city)
  async function fetchOptionsNow() {
    const qs = new URLSearchParams({
      country: country || '',
      stateProvince: region || '',
      city: city || '',
    });
    const data: OptionsResp = await api(`/settings/options?${qs.toString()}`);
    setOpts(data);
    // If region was empty, pick the first available
    if (!region && data.stateProvinces?.length) {
      setRegion(data.stateProvinces[0] || '');
    }
    // If no LS set yet, preview suggestion
    if (!settings.lsCategories || settings.lsCategories.length === 0) {
      setLsCats(data.suggestedLsCategories || []);
    }
  }
  useEffect(() => {
    void fetchOptionsNow(); /* country change triggers region list swap */
  }, [country]);
  useEffect(() => {
    void fetchOptionsNow();
  }, [region]);
  useEffect(() => {
    const t = setTimeout(() => {
      void fetchOptionsNow();
    }, 300);
    return () => clearTimeout(t);
  }, [city]);

  // AI Boards
  async function findBoardsAI() {
    if (!country || !region || !city) {
      alert('Please select country, state/province, and enter your city.');
      return;
    }
    const qs = new URLSearchParams({ country, region, city });
    const res = await api(`/settings/options/boards?${qs.toString()}`);
    setBoardHits(res?.boards || []);
  }

  // Auto-configure from a chosen board
  async function applyBoardAndBootstrap(boardName: string) {
    if (!boardName) {
      alert('Pick a board first (click a pill).');
      return;
    }

    // Save initial choice so user doesn’t lose selection if AI call is slow
    setSelectedBoardName(boardName);

    // Save board (and rough jurisdiction guess) immediately
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        jurisdiction: (country || '').toLowerCase(), // refined by bootstrap
        board: boardName,
      }),
    });

    // Ask backend AI to bootstrap LS/Subjects/Bands
    const inferred = await api('/settings/ai/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ country, region, city, board: boardName }),
    });

    // Merge into UI
    setSettings(inferred || {});
    setLsCats((inferred?.lsCategories as LsCat[]) || []);
    setSubjects(inferred?.subjects || []);
    setGradeBands(inferred?.gradeBands || []);

    // Ensure profiles pick up new categories
    await api('/learning-skills/sync-from-settings', {
      method: 'POST',
      body: JSON.stringify({ force: true }),
    });
    try {
      localStorage.setItem('settings:changed', String(Date.now()));
    } catch {}

    alert('Board selected and learning skills/subjects configured ✅');
  }

  function reorder<T>(arr: T[], i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = arr.slice();
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    return next;
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          jurisdiction: settings.jurisdiction || opts?.suggestedJurisdiction || null,
          board: selectedBoardName || settings.board || null,
          terms,
          subjects,
          gradeBands,
          lsCategories: lsCats,
        }),
      });
      setSettings(saved);

      // Make sure profiles pick up new categories
      await api('/learning-skills/sync-from-settings', {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      });
      try {
        localStorage.setItem('settings:changed', String(Date.now()));
      } catch {}

      alert('Settings saved 👍');
    } finally {
      setSaving(false);
    }
  }

  async function fetchCurriculum() {
    setCurriculumLog('Importing curriculum…');
    try {
      const res = await api('/standards/seed-curriculum', {
        method: 'POST',
        body: JSON.stringify({
          country,
          stateProvince: region,
          board: selectedBoardName || null,
          grades: gradesForImport,
          subjects: subjects.length ? subjects : undefined,
        }),
      });
      setCurriculumLog(
        `Imported ${res?.subjectsAdded?.length || 0} subject(s). Example set: ${res?.set?.name || ''} (${res?.set?.gradeBand || ''}).`,
      );
      const added: string[] = res?.subjectsAdded || [];
      if (added.length) setSubjects((prev) => Array.from(new Set([...prev, ...added])));
    } catch {
      setCurriculumLog('Could not import curriculum right now.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="header-row">
          <h2 className="title">⚙️ Settings</h2>
          <div className="actions">
            <button className="btn" onClick={load}>
              Reload
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        <div className="muted mt-1">These settings power the Comment Bank & Student Profile comment generator.</div>
      </div>

      {/* GEO → BOARD */}
      <div className="card">
        <h3 className="subtitle">🌍 Location & Board</h3>
        <div className="chip-row mt-2">
          <div className="chip">
            <span>Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {(opts?.countries || ['Canada', 'United States', 'United Kingdom', 'Australia']).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="chip">
            <span>State/Province</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {(opts?.stateProvinces || []).map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          <div className="chip">
            <span>City</span>
            <input className="input bare" placeholder="e.g., your city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          <button className="btn" onClick={findBoardsAI}>
            🔎 Find Boards (AI)
          </button>
        </div>

        <div className="board-pills mt-3">
          {(boardHits || []).map((b, idx) => (
            <button
              key={`${b.name}-${idx}`}
              className={`pill ${selectedBoardName === b.name ? 'on' : ''}`}
              onClick={() => setSelectedBoardName(b.name)}
              title={b.url ? `${b.name} — ${b.url}` : b.name}
            >
              {b.name}
              {typeof b.score === 'number' ? ` · ${(b.score * 100) | 0}%` : ''}
            </button>
          ))}
          {(!boardHits || boardHits.length === 0) && <div className="muted">No boards yet. Adjust filters and click “Find Boards (AI)”.</div>}
        </div>

        <div className="muted mt-2">
          Selected board: <strong>{selectedBoardName || settings.board || '—'}</strong>
        </div>

        <div className="actions mt-3">
          <button
            className="btn btn-primary"
            onClick={() => applyBoardAndBootstrap(selectedBoardName || settings.board || '')}
            disabled={!(selectedBoardName || settings.board)}
          >
            ✨ Auto-configure from board
          </button>
        </div>
      </div>

      {/* LEARNING SKILLS */}
      <div className="card">
        <h3 className="subtitle">🧩 Learning Skills Categories</h3>
        <div className="muted">Edit, re-order, add/remove. These feed the Learning Skills generator.</div>

        <div className="ls-grid mt-3">
          {lsCats.map((c, i) => (
            <div key={c.id || i} className="ls-item">
              <input
                className="input"
                value={c.label}
                onChange={(e) => {
                  const v = e.target.value;
                  setLsCats((prev) => {
                    const next = prev.slice();
                    next[i] = { id: v.toLowerCase().replace(/\s+/g, '-'), label: v };
                    return next;
                  });
                }}
              />
              <div className="mini-actions">
                <button className="btn" onClick={() => setLsCats((prev) => reorder(prev, i, -1))}>
                  ↑
                </button>
                <button className="btn" onClick={() => setLsCats((prev) => reorder(prev, i, 1))}>
                  ↓
                </button>
                <button className="btn" onClick={() => setLsCats((prev) => prev.filter((_, idx) => idx !== i))}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="actions mt-2">
          <button
            className="btn"
            onClick={() => setLsCats((prev) => [...prev, { id: `custom-${Date.now()}`, label: 'New Category' }])}
          >
            ＋ Add Category
          </button>
        </div>
      </div>

      {/* TERMS / SUBJECTS / BANDS */}
      <div className="card">
        <h3 className="subtitle">📚 Terms, Subjects & Grade Bands</h3>

        <div className="chip-row mt-2">
          <div className="chip">
            <span>Terms</span>
            <select
              value={String(terms)}
              onChange={(e) => {
                const n = parseInt(e.target.value || '3', 10);
                setTerms(n);
                setTermLabels(Array.from({ length: n }, (_, i) => `T${i + 1}`));
              }}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <div className="chip">
            <span>Labels</span>
            <input
              className="input bare"
              value={termLabels.join(', ')}
              onChange={(e) => {
                const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                setTermLabels(list);
              }}
            />
          </div>
        </div>

        <div className="grid2 gap-lg mt-3">
          <div>
            <div className="label">Subjects</div>
            <div className="pill-edit">
              {subjects.map((s, i) => (
                <span key={s} className="pill on">
                  {s}
                  <button onClick={() => setSubjects((prev) => prev.filter((x) => x !== s))}>×</button>
                  <button onClick={() => setSubjects((prev) => reorder(prev, i, -1))}>↑</button>
                  <button onClick={() => setSubjects((prev) => reorder(prev, i, 1))}>↓</button>
                </span>
              ))}
            </div>
            <div className="chip-row mt-2">
              <input className="input" placeholder="Add subject…" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
              <button
                className="btn"
                onClick={() => {
                  const s = newSubject.trim();
                  if (!s) return;
                  setSubjects((prev) => Array.from(new Set([...prev, s])));
                  setNewSubject('');
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <div className="label">Grade Bands</div>
            <div className="pill-edit">
              {gradeBands.map((b, i) => (
                <span key={b} className="pill on">
                  {b}
                  <button onClick={() => setGradeBands((prev) => prev.filter((x) => x !== b))}>×</button>
                  <button onClick={() => setGradeBands((prev) => reorder(prev, i, -1))}>↑</button>
                  <button onClick={() => setGradeBands((prev) => reorder(prev, i, 1))}>↓</button>
                </span>
              ))}
            </div>
            <div className="chip-row mt-2">
              <input className="input" placeholder="Add band (e.g., K–3)" value={newBand} onChange={(e) => setNewBand(e.target.value)} />
              <button
                className="btn"
                onClick={() => {
                  const b = newBand.trim();
                  if (!b) return;
                  setGradeBands((prev) => Array.from(new Set([...prev, b])));
                  setNewBand('');
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CURRICULUM */}
      <div className="card">
        <h3 className="subtitle">📖 Curriculum</h3>
        <div className="muted">Fetch standards for the selected board/grades. This powers subject suggestions.</div>

        <div className="chip-row mt-2">
          <div className="chip">
            <span>Grades</span>
            <input
              className="input bare"
              value={gradesForImport.join(', ')}
              onChange={(e) => {
                const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                setGradesForImport(list.length ? list : ['K-8']);
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={fetchCurriculum} disabled={!selectedBoardName && !settings.board}>
            📥 Fetch curriculum
          </button>
        </div>
        {curriculumLog && <div className="muted mt-2">{curriculumLog}</div>}
      </div>

      <style jsx>{`
        .title { font-size: 20px; font-weight: 800; display:flex; gap:8px; align-items:center; }
        .subtitle { font-size: 16px; font-weight: 700; }
        .muted { color: var(--muted); }
        .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; }
        .card { background: var(--panel, #0e122b); border:1px solid var(--border,#1f2547); border-radius:16px; padding:16px; }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; flex-wrap:wrap; }
        .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .chip { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); }
        .chip .input.bare, .chip select { background: transparent; border: none; outline: none; color: inherit; }
        .input { width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:10px; padding:8px 10px; color:inherit; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; transition: transform .06s ease; }
        .btn:active { transform: scale(0.98); }
        .btn-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
        .board-pills { display:flex; gap:8px; flex-wrap:wrap; }
        .pill { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); cursor:pointer; }
        .pill.on { background: rgba(99,102,241,0.20); border-color: rgba(99,102,241,0.55); }
        .pill-edit { display:flex; gap:8px; flex-wrap:wrap; }
        .pill-edit .pill button { margin-left:6px; background:transparent; border:none; color:inherit; cursor:pointer; }
        .label { font-size:12px; color: var(--muted); margin-bottom:6px; }
        .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width:900px){ .grid2 { grid-template-columns: 1fr; } }
        .ls-grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
        @media (max-width:900px){ .ls-grid { grid-template-columns: 1fr; } }
        .ls-item { display:flex; gap:8px; align-items:center; }
        .mini-actions { display:flex; gap:6px; }
      `}</style>
    </div>
  );
}