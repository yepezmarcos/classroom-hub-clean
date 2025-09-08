'use client';

import { useMemo, useRef, useState } from 'react';

/**
 * Roster import (AI-style, no template required)
 * - Drag & drop any CSV/TSV/XLSX.
 * - Or paste a public Google Sheets link (we convert it to CSV server-side to avoid CORS).
 * - We infer columns (first/last/grade/gender/etc + up to TWO guardians).
 * - You can adjust mappings before importing.
 * - Uses /api/proxy/students to create records.
 *
 * NOTE: to support .xlsx parsing, install:
 *   npm i -w @hub/web xlsx
 */

type RowObj = Record<string, string | number | null | undefined>;

type Guess =
  | 'first'
  | 'last'
  | 'grade'
  | 'gender'
  | 'pronouns'
  | 'iep'
  | 'ell'
  | 'medical'
  | 'guardian_name'
  | 'guardian_email'
  | 'guardian_phone'
  | 'relationship'
  | 'guardian2_name'
  | 'guardian2_email'
  | 'guardian2_phone'
  | 'relationship2';

const TARGETS: { key: Guess; label: string; help?: string }[] = [
  { key: 'first', label: 'First name' },
  { key: 'last', label: 'Last name' },
  { key: 'grade', label: 'Grade', help: 'K, 1–12, etc.' },
  { key: 'gender', label: 'Gender', help: 'male/female/nonbinary/unspecified/custom' },
  { key: 'pronouns', label: 'Pronouns', help: 'e.g., she/her/her' },
  { key: 'iep', label: 'IEP', help: 'yes/no' },
  { key: 'ell', label: 'ELL', help: 'yes/no' },
  { key: 'medical', label: 'Medical', help: 'yes/no' },

  // Guardian 1
  { key: 'guardian_name', label: 'Guardian 1 name' },
  { key: 'guardian_email', label: 'Guardian 1 email' },
  { key: 'guardian_phone', label: 'Guardian 1 phone' },
  { key: 'relationship', label: 'Guardian 1 relationship', help: 'Mother/Father/Guardian/...' },

  // Guardian 2
  { key: 'guardian2_name', label: 'Guardian 2 name' },
  { key: 'guardian2_email', label: 'Guardian 2 email' },
  { key: 'guardian2_phone', label: 'Guardian 2 phone' },
  { key: 'relationship2', label: 'Guardian 2 relationship' },
];

function norm(s: any): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isEmail(v: any) {
  return /.+@.+\..+/.test(String(v || '').toLowerCase());
}
function isPhone(v: any) {
  const digits = String(v || '').replace(/\D+/g, '');
  return digits.length >= 10;
}
function isYesNo(v: any) {
  const s = norm(v);
  return ['y', 'yes', 'true', '1', 'n', 'no', 'false', '0'].includes(s);
}
function truthy(v: any) {
  const s = norm(v);
  return ['y', 'yes', 'true', '1'].includes(s);
}
function maybeGrade(v: any) {
  const s = norm(v);
  if (!s) return false;
  if (['k', 'jk', 'sk'].includes(s)) return true;
  if (/^(gr|grade)\s*\d{1,2}$/.test(s)) return true;
  const n = parseInt(s, 10);
  return !isNaN(n) && n >= 0 && n <= 12;
}
function maybeGender(v: any) {
  const s = norm(v);
  return ['male', 'm', 'female', 'f', 'nonbinary', 'nb', 'unspecified', 'custom'].includes(s);
}
function headerContains(h: string, ...needles: string[]) {
  const s = norm(h);
  return needles.some((n) => s.includes(n));
}

// CSV/TSV reader with quote support; delimiter = ',' or '\t' or ';'
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        cur.push(field);
        field = '';
      } else if (ch === '\r') {
        // ignore
      } else if (ch === '\n') {
        cur.push(field);
        field = '';
        rows.push(cur);
        cur = [];
      } else {
        field += ch;
      }
    }
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

async function readAnyFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    return rows.map((r) => r.map((c) => (c == null ? '' : String(c))));
  } else {
    const text = await file.text();
    // detect delimiter by frequency on first line
    const firstLine = (text.split(/\r?\n/)[0] || '');
    const counts = [
      [',', (firstLine.match(/,/g) || []).length],
      ['\t', (firstLine.match(/\t/g) || []).length],
      [';', (firstLine.match(/;/g) || []).length],
    ] as const;
    const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
    return parseDelimited(text, delim);
  }
}

// >>> changed: use server helper to fetch Google Sheets CSV (no CORS)
async function readGoogleSheet(url: string): Promise<string[][]> {
  const res = await fetch(`/api/gsheet?u=${encodeURIComponent(url)}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Sheets fetch failed (${res.status})`);
  }
  const text = await res.text();
  return parseDelimited(text, ',');
}

function findHeaderRow(rows: string[][]): { header: string[]; startIndex: number } {
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const score = rows[i].reduce((acc, c) => (String(c || '').trim() ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  const header = rows[bestIdx].map((h) => String(h || '').trim());
  return { header, startIndex: bestIdx + 1 };
}

function toObjects(header: string[], rows: string[][]): RowObj[] {
  return rows
    .filter((r) => r.some((c) => String(c || '').trim()))
    .map((r) => {
      const o: RowObj = {};
      header.forEach((h, i) => (o[h] = r[i] ?? ''));
      return o;
    });
}

function guessMapping(header: string[], sample: RowObj[]) {
  const map = new Map<Guess, string | null>();
  const headerSet = header.map((h) => h.trim()).filter(Boolean);

  function scoreHeader(h: string, key: Guess): number {
    const hnorm = norm(h);

    const pts: Record<Guess, number> = {
      first: 0,
      last: 0,
      grade: 0,
      gender: 0,
      pronouns: 0,
      iep: 0,
      ell: 0,
      medical: 0,
      guardian_name: 0,
      guardian_email: 0,
      guardian_phone: 0,
      relationship: 0,
      guardian2_name: 0,
      guardian2_email: 0,
      guardian2_phone: 0,
      relationship2: 0,
    };

    if (key === 'first' && /(^|[^a-z])(first|fname|given)([^a-z]|$)/.test(hnorm)) pts.first += 5;
    if (key === 'last' && /(^|[^a-z])(last|lname|surname|family)([^a-z]|$)/.test(hnorm)) pts.last += 5;
    if (key === 'grade' && headerContains(h, 'grade', 'gr', 'level', 'yr', 'year')) pts.grade += 4;
    if (key === 'gender' && headerContains(h, 'gender', 'sex')) pts.gender += 4;
    if (key === 'pronouns' && headerContains(h, 'pronoun')) pts.pronouns += 5;
    if (key === 'iep' && (headerContains(h, 'iep') || headerContains(h, 'special'))) pts.iep += 5;
    if (key === 'ell' && (headerContains(h, 'ell') || headerContains(h, 'esl') || headerContains(h, 'eal'))) pts.ell += 5;
    if (key === 'medical' && headerContains(h, 'med')) pts.medical += 5;

    const guardianish = ['guardian', 'parent', 'mother', 'father', 'custodian', 'caregiver', 'contact'];
    if (['guardian_name', 'guardian_email', 'guardian_phone', 'relationship', 'guardian2_name', 'guardian2_email', 'guardian2_phone', 'relationship2'].includes(key)) {
      const isTwo =
        hnorm.includes('2') ||
        hnorm.includes('two') ||
        hnorm.includes('secondary') ||
        hnorm.includes('alt') ||
        hnorm.includes('alternate') ||
        hnorm.includes('other');

      if (guardianish.some((g) => hnorm.includes(g))) {
        if (isTwo) {
          if (key === 'guardian2_name') pts.guardian2_name += 3;
          if (key === 'guardian2_email') pts.guardian2_email += 3;
          if (key === 'guardian2_phone') pts.guardian2_phone += 3;
          if (key === 'relationship2') pts.relationship2 += 3;
        } else {
          if (key === 'guardian_name') pts.guardian_name += 3;
          if (key === 'guardian_email') pts.guardian_email += 3;
          if (key === 'guardian_phone') pts.guardian_phone += 3;
          if (key === 'relationship') pts.relationship += 3;
        }
      }
      if (key.endsWith('email') && headerContains(h, 'email', 'e-mail', 'mail')) {
        if (isTwo) pts.guardian2_email += 4;
        else pts.guardian_email += 4;
      }
      if (key.endsWith('phone') && headerContains(h, 'phone', 'tel', 'cell', 'mobile')) {
        if (isTwo) pts.guardian2_phone += 4;
        else pts.guardian_phone += 4;
      }
      if ((key === 'guardian_name' || key === 'guardian2_name') && headerContains(h, 'name', 'full')) {
        if (isTwo) pts.guardian2_name += 3;
        else pts.guardian_name += 3;
      }
      if ((key === 'relationship' || key === 'relationship2') && headerContains(h, 'relationship')) {
        if (isTwo) pts.relationship2 += 5;
        else pts.relationship += 5;
      }
    }

    const values = sample.map((r) => r[h]).slice(0, 50);
    const hitEmail = values.filter(isEmail).length;
    const hitPhone = values.filter(isPhone).length;

    if (key === 'guardian_email') pts.guardian_email += hitEmail >= 3 ? 6 : hitEmail >= 1 ? 3 : 0;
    if (key === 'guardian2_email') pts.guardian2_email += hitEmail >= 3 ? 6 : hitEmail >= 1 ? 3 : 0;

    if (key === 'guardian_phone') pts.guardian_phone += hitPhone >= 3 ? 5 : hitPhone >= 1 ? 2 : 0;
    if (key === 'guardian2_phone') pts.guardian2_phone += hitPhone >= 3 ? 5 : hitPhone >= 1 ? 2 : 0;

    if (key === 'grade') {
      const hit = values.filter(maybeGrade).length;
      pts.grade += hit >= 3 ? 4 : hit >= 1 ? 2 : 0;
    }
    if (key === 'gender') {
      const hit = values.filter(maybeGender).length;
      pts.gender += hit >= 3 ? 4 : hit >= 1 ? 2 : 0;
    }
    if (key === 'iep' || key === 'ell' || key === 'medical') {
      const hit = values.filter(isYesNo).length;
      (pts as any)[key] += hit >= 3 ? 3 : hit >= 1 ? 1 : 0;
    }

    return (pts as any)[key] || 0;
  }

  TARGETS.forEach(({ key }) => {
    let best: string | null = null;
    let bestScore = 0;
    for (const h of headerSet) {
      const sc = scoreHeader(h, key);
      if (sc > bestScore) {
        best = h;
        bestScore = sc;
      }
    }
    if (bestScore >= 3) map.set(key, best);
    else map.set(key, null);
  });

  if (!map.get('guardian_name')) {
    const candidate = headerSet.find((h) => headerContains(h, 'guardian', 'parent') && headerContains(h, 'name'));
    if (candidate) map.set('guardian_name', candidate);
  }
  if (!map.get('guardian2_name')) {
    const candidate2 = headerSet.find(
      (h) => (headerContains(h, 'guardian 2', 'parent 2', 'secondary', 'alternate', 'other') || /guardian.*2/.test(norm(h))) &&
        headerContains(h, 'name')
    );
    if (candidate2) map.set('guardian2_name', candidate2);
  }

  return map;
}

function derivePronouns(gender?: string | null, existing?: string | null): string | null {
  if (existing && existing.trim().length > 0) return existing.trim();
  switch ((gender || '').toLowerCase()) {
    case 'male':
    case 'm':
      return 'he/him/his';
    case 'female':
    case 'f':
      return 'she/her/her';
    case 'nonbinary':
    case 'nb':
      return 'they/them/their';
    default:
      return null;
  }
}

export default function RosterAIImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<RowObj[]>([]);
  const [mapping, setMapping] = useState<Map<Guess, string | null>>(new Map());
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ ok: boolean; error?: string; first?: string; last?: string }[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const file = files[0];
    try {
      const table = await readAnyFile(file);
      if (!table.length) return resetState();
      hydrateFromTable(table);
    } catch {
      alert('Could not read that file. Try CSV/TSV/XLSX.');
    }
  }

  function resetState() {
    setHeader([]);
    setRows([]);
    setMapping(new Map());
  }

  function hydrateFromTable(table: string[][]) {
    const { header, startIndex } = findHeaderRow(table);
    const data = toObjects(header, table.slice(startIndex));
    const sample = data.slice(0, 100);
    const guessed = guessMapping(header, sample);
    setHeader(header);
    setRows(data);
    setMapping(guessed);
  }

  async function handleLoadSheet() {
    if (!sheetUrl.trim()) return;
    try {
      setSheetLoading(true);
      const table = await readGoogleSheet(sheetUrl.trim());
      if (!table.length) return resetState();
      hydrateFromTable(table);
    } catch (e: any) {
      alert(
        (e?.message as string) ||
          'Could not load that Google Sheet. Share it as "Anyone with the link — Viewer".'
      );
    } finally {
      setSheetLoading(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    onFiles(e.dataTransfer.files);
  }

  function setMap(key: Guess, value: string | null) {
    const m = new Map(mapping);
    m.set(key, value);
    setMapping(m);
  }

  const preview = useMemo(() => {
    const rowsPreview = rows.slice(0, 5).map((r) => {
      function pick(h: Guess) {
        const col = mapping.get(h);
        return col ? (r[col] ?? '') : '';
      }
      const g = String(pick('gender') || '');
      const pnRaw = String(pick('pronouns') || '');
      const pn = derivePronouns(g, pnRaw);

      const g1 = {
        name: String(pick('guardian_name') || ''),
        email: String(pick('guardian_email') || ''),
        phone: String(pick('guardian_phone') || ''),
        relationship: String(pick('relationship') || ''),
      };
      const g2 = {
        name: String(pick('guardian2_name') || ''),
        email: String(pick('guardian2_email') || ''),
        phone: String(pick('guardian2_phone') || ''),
        relationship: String(pick('relationship2') || ''),
      };

      return {
        first: String(pick('first') || ''),
        last: String(pick('last') || ''),
        grade: String(pick('grade') || ''),
        gender: g || null,
        pronouns: pn,
        iep: truthy(pick('iep')),
        ell: truthy(pick('ell')),
        medical: truthy(pick('medical')),
        guardians: [g1, g2],
      };
    });
    return { rows: rowsPreview };
  }, [rows, mapping]);

  async function doImport() {
    if (!rows.length) return;
    setImporting(true);
    setResults([]);

    const res: { ok: boolean; error?: string; first?: string; last?: string }[] = [];

    for (const r of rows) {
      const pick = (k: Guess) => {
        const col = mapping.get(k);
        return col ? r[col] : '';
      };

      const gender = String(pick('gender') || '');
      const pronouns = derivePronouns(gender, String(pick('pronouns') || ''));

      const g1 = {
        name: String(pick('guardian_name') || ''),
        email: String(pick('guardian_email') || ''),
        phone: String(pick('guardian_phone') || ''),
        relationship: String(pick('relationship') || ''),
      };
      const g2 = {
        name: String(pick('guardian2_name') || ''),
        email: String(pick('guardian2_email') || ''),
        phone: String(pick('guardian2_phone') || ''),
        relationship: String(pick('relationship2') || ''),
      };

      const guardians = [g1, g2]
        .filter((g) => g.name || g.email || g.phone)
        .map((g) => ({
          name: g.name || (g.email ? g.email.split('@')[0] : 'Guardian'),
          email: g.email || undefined,
          phone: g.phone || undefined,
          relationship: g.relationship || undefined,
        }));

      const payload = {
        first: String(pick('first') || '').trim(),
        last: String(pick('last') || '').trim(),
        grade: String(pick('grade') || '').trim() || null,
        gender: gender || null,
        pronouns,
        iep: truthy(pick('iep')),
        ell: truthy(pick('ell')),
        medical: truthy(pick('medical')),
        guardians,
      };

      if (!payload.first || !payload.last) {
        res.push({ ok: false, first: payload.first, last: payload.last, error: 'Missing first/last' });
        continue;
      }

      try {
        const rr = await fetch('/api/proxy/students', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!rr.ok) {
          const t = await rr.text().catch(() => '');
          res.push({ ok: false, first: payload.first, last: payload.last, error: t || rr.statusText });
        } else {
          res.push({ ok: true, first: payload.first, last: payload.last });
        }
      } catch (e: any) {
        res.push({ ok: false, first: payload.first, last: payload.last, error: e?.message || 'Network error' });
      }
    }

    setResults(res);
    setImporting(false);
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Import roster (smart)</h1>
          <p className="text-sm text-[var(--muted)]">
            Drop any spreadsheet (CSV / TSV / XLSX) or paste a public Google Sheets link. I’ll detect columns automatically — you can adjust before import.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div className="card">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-md p-8 cursor-pointer transition
            ${dragOver ? 'border-[var(--primary)] bg-[var(--subtle)]' : 'border-[var(--border)]'}`}
        >
          <div className="text-lg font-medium">Drop roster here</div>
          <div className="text-sm text-[var(--muted)] mt-1">…or click to choose a file</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <button
            type="button"
            className="btn mt-4"
            onClick={() => inputRef.current?.click()}
          >
            Browse
          </button>
        </label>
      </div>

      {/* Google Sheets */}
      <div className="card">
        <div className="flex flex-col gap-2">
          <label className="font-medium">Import from Google Sheets</label>
          <div className="flex gap-2">
            <input
              type="url"
              className="input flex-1"
              placeholder="Paste public Google Sheets link (Anyone with the link)"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleLoadSheet} disabled={sheetLoading || !sheetUrl.trim()}>
              {sheetLoading ? 'Loading…' : 'Load'}
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Tip: Share your Sheet as “Anyone with the link — Viewer”. We fetch it server-side to avoid CORS.
          </p>
        </div>
      </div>

      {/* Mapping */}
      {!!header.length && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Detected columns</h2>
            <div className="text-xs text-[var(--muted)]">{header.length} columns · {rows.length} rows</div>
          </div>

          <div className="overflow-auto border border-[var(--border)] rounded">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-[var(--subtle)]">
                <tr>
                  <th className="text-left p-2 font-medium w-56">Field</th>
                  <th className="text-left p-2 font-medium">Match</th>
                  <th className="text-left p-2 font-medium">Examples</th>
                </tr>
              </thead>
              <tbody>
                {TARGETS.map(({ key, label, help }) => {
                  const sel = mapping.get(key) || '';
                  const examples = rows.slice(0, 3).map((r) => (sel ? String(r[sel] ?? '') : '')).join(' · ');
                  return (
                    <tr key={key} className="border-t border-[var(--border)]">
                      <td className="p-2">
                        <div className="font-medium">{label}</div>
                        {help ? <div className="text-xs text-[var(--muted)]">{help}</div> : null}
                      </td>
                      <td className="p-2">
                        <select
                          className="input w-full"
                          value={sel}
                          onChange={(e) => setMap(key, e.target.value || null)}
                        >
                          <option value="">— ignore —</option>
                          {header.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-[var(--muted)]">{examples || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview + Import */}
      {!!header.length && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Preview (first 5)</h2>
          <div className="overflow-auto border border-[var(--border)] rounded">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-[var(--subtle)]">
                <tr>
                  <th className="text-left p-2 font-medium">First</th>
                  <th className="text-left p-2 font-medium">Last</th>
                  <th className="text-left p-2 font-medium">Grade</th>
                  <th className="text-left p-2 font-medium">Gender</th>
                  <th className="text-left p-2 font-medium">Pronouns</th>
                  <th className="text-left p-2 font-medium">IEP</th>
                  <th className="text-left p-2 font-medium">ELL</th>
                  <th className="text-left p-2 font-medium">Medical</th>
                  <th className="text-left p-2 font-medium">Guardian 1</th>
                  <th className="text-left p-2 font-medium">G1 email</th>
                  <th className="text-left p-2 font-medium">G1 phone</th>
                  <th className="text-left p-2 font-medium">G1 relationship</th>
                  <th className="text-left p-2 font-medium">Guardian 2</th>
                  <th className="text-left p-2 font-medium">G2 email</th>
                  <th className="text-left p-2 font-medium">G2 phone</th>
                  <th className="text-left p-2 font-medium">G2 relationship</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => {
                  const g1 = r.guardians[0];
                  const g2 = r.guardians[1];
                  return (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="p-2">{r.first}</td>
                      <td className="p-2">{r.last}</td>
                      <td className="p-2">{r.grade}</td>
                      <td className="p-2">{r.gender || '—'}</td>
                      <td className="p-2">{r.pronouns || '—'}</td>
                      <td className="p-2">{r.iep ? 'Yes' : 'No'}</td>
                      <td className="p-2">{r.ell ? 'Yes' : 'No'}</td>
                      <td className="p-2">{r.medical ? 'Yes' : 'No'}</td>
                      <td className="p-2">{g1.name || '—'}</td>
                      <td className="p-2">{g1.email || '—'}</td>
                      <td className="p-2">{g1.phone || '—'}</td>
                      <td className="p-2">{g1.relationship || '—'}</td>
                      <td className="p-2">{g2.name || '—'}</td>
                      <td className="p-2">{g2.email || '—'}</td>
                      <td className="p-2">{g2.phone || '—'}</td>
                      <td className="p-2">{g2.relationship || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={doImport} disabled={!rows.length || importing}>
              {importing ? 'Importing…' : 'Import'}
            </button>
            {!!results.length && (
              <div className="text-sm">
                <span className="badge">{ok} imported</span>
                {fail ? <span className="badge" style={{ marginLeft: 8 }}>{fail} failed</span> : null}
              </div>
            )}
          </div>

          {!!results.length && (
            <div className="text-sm mt-2 space-y-1">
              {results.filter((r) => !r.ok).slice(0, 50).map((r, i) => (
                <div key={i} className="p-2 border border-red-200 rounded text-red-700">
                  {r.first} {r.last}: {r.error}
                </div>
              ))}
              {fail > 50 ? (
                <div className="text-xs text-[var(--muted)]">Showing first 50 failures…</div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}