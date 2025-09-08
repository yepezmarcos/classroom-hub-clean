'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

type Row = Record<string, string>;
type MapKey =
    | 'first' | 'last' | 'grade' | 'email' | 'gender' | 'pronouns'
    | 'iep' | 'ell' | 'medical'
    | 'guardian_name' | 'guardian_email' | 'guardian_phone' | 'guardian_relationship';

const REQUIRED: MapKey[] = ['first', 'last'];
const OPTIONAL: MapKey[] = [
    'grade','email','gender','pronouns','iep','ell','medical',
    'guardian_name','guardian_email','guardian_phone','guardian_relationship',
];

const FRIENDLY: Record<MapKey, string> = {
    first: 'First Name',
    last: 'Last Name',
    grade: 'Grade',
    email: 'Student Email',
    gender: 'Gender',
    pronouns: 'Pronouns',
    iep: 'IEP',
    ell: 'ELL',
    medical: 'Medical',
    guardian_name: 'Guardian Name',
    guardian_email: 'Guardian Email',
    guardian_phone: 'Guardian Phone',
    guardian_relationship: 'Guardian Relationship',
};

const AUTODETECT_PATTERNS: [MapKey, RegExp][] = [
    ['first', /\b(first|first\s*name|given)\b/i],
    ['last', /\b(last|last\s*name|surname|family)\b/i],
    ['grade', /\bgrade\b/i],
    ['email', /\b(student\s*)?email\b/i],
    ['gender', /\bgender|sex\b/i],
    ['pronouns', /\bpronoun/i],
    ['iep', /\biep\b/i],
    ['ell', /\bell\b/i],
    ['medical', /\bmedical|health\b/i],
    ['guardian_name', /\b(parent|guardian).*(name)|\bguardian\b/i],
    ['guardian_email', /\b(parent|guardian).*(email)|\bguardian\s*email\b/i],
    ['guardian_phone', /\b(parent|guardian).*(phone|cell|mobile|tel)|\bguardian\s*phone\b/i],
    ['guardian_relationship', /\b(parent|guardian).*(relationship|relation)|\brelationship\b/i],
];

function coerceBool(v: string) {
    const s = (v || '').trim().toLowerCase();
    if (!s) return false;
    return ['y','yes','true','1','t'].includes(s);
}

async function readFileText(file: File) {
    return await file.text();
}

function simpleCSVParse(text: string): Row[] {
    // Minimal CSV parser supporting quoted fields and commas
    const rows: Row[] = [];
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.length > 0);
    if (lines.length === 0) return rows;
    const parseLine = (line: string) => {
        const out: string[] = [];
        let cur = '';
        let q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (q) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { cur += '"'; i++; }
                    else { q = false; }
                } else {
                    cur += ch;
                }
            } else {
                if (ch === ',') { out.push(cur); cur = ''; }
                else if (ch === '"') { q = true; }
                else { cur += ch; }
            }
        }
        out.push(cur);
        return out;
    };
    const header = parseLine(lines[0]).map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        const row: Row = {};
        header.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
        rows.push(row);
    }
    return rows;
}

function autoMap(headers: string[]) {
    const used = new Set<number>();
    const map: Partial<Record<MapKey, string>> = {};
    for (const [key, rx] of AUTODETECT_PATTERNS) {
        const idx = headers.findIndex((h, i) => !used.has(i) && rx.test(h));
        if (idx >= 0) { map[key] = headers[idx]; used.add(idx); }
    }
    return map;
}

type Result = { ok: boolean; message: string; studentName?: string };

export default function ImportStudentsPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Partial<Record<MapKey, string>>>({});
    const [parsing, setParsing] = useState(false);

    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState<Result[]>([]);
    const [progress, setProgress] = useState(0);

    const fileRef = useRef<HTMLInputElement>(null);

    const hasRequired = useMemo(() => REQUIRED.every(k => mapping[k]), [mapping]);

    function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        void handleFile(f);
    }

    async function handleFile(file: File) {
        try {
            setParsing(true);
            const text = await readFileText(file);
            // Try dynamic Papa first (if user has it installed), else fallback
            let parsed: Row[] | null = null;
            try {
                const Papa: any = await import('papaparse');
                const out = Papa.parse(text, { header: true, skipEmptyLines: true });
                parsed = Array.isArray(out?.data) ? out.data as Row[] : null;
            } catch {
                parsed = simpleCSVParse(text);
            }
            const hs = parsed && parsed[0] ? Object.keys(parsed[0]) : [];
            setHeaders(hs);
            setRows(parsed || []);
            setMapping(autoMap(hs));
        } finally {
            setParsing(false);
        }
    }

    function headerSelect(name: MapKey, header: string) {
        setMapping(m => ({ ...m, [name]: header || undefined as any }));
    }

    const preview = useMemo(() => rows.slice(0, 8), [rows]);

    async function tryBulkImport(payload: any) {
        const endpoints = [
            { url: '/students/import', method: 'POST' as const },
            { url: '/api/students/import', method: 'POST' as const },
        ];
        for (const e of endpoints) {
            try { await api(e.url, { method: e.method, body: JSON.stringify(payload) }); return true; } catch {}
        }
        return false;
    }

    async function tryCreateStudentAndGuardian(row: Row): Promise<Result> {
        const get = (k: MapKey) => {
            const h = mapping[k]; if (!h) return '';
            return String(row[h] ?? '').trim();
        };
        const payload: any = {
            first: get('first'), last: get('last'),
            grade: get('grade') || null,
            email: get('email') || null,
            gender: get('gender') || null,
            pronouns: get('pronouns') || null,
            iep: coerceBool(get('iep')),
            ell: coerceBool(get('ell')),
            medical: coerceBool(get('medical')),
        };
        const guardian: any = {
            name: get('guardian_name') || '',
            email: get('guardian_email') || '',
            phone: get('guardian_phone') || '',
            relationship: get('guardian_relationship') || '',
        };
        const hasGuardian = Object.values(guardian).some(v => String(v).trim());

        // 1) Try create with embedded guardians
        try {
            const res = await api('/students', {
                method: 'POST',
                body: JSON.stringify({
                    ...payload,
                    guardians: hasGuardian ? [guardian] : undefined,
                    parents: undefined,
                    links: undefined,
                }),
            });
            const sid = res?.id;
            if (sid && hasGuardian) {
                // If API ignored embedded guardian, try attaching after
                await tryAttachGuardian(sid, guardian);
            }
            return { ok: true, message: 'Imported', studentName: `${payload.first} ${payload.last}` };
        } catch (e: any) {
            // 2) Fallback: create student only, then attach guardian via multiple attempts
            try {
                const stu = await api('/students', { method: 'POST', body: JSON.stringify(payload) });
                const sid = stu?.id;
                if (sid && hasGuardian) await tryAttachGuardian(sid, guardian);
                return { ok: true, message: 'Imported (fallback)', studentName: `${payload.first} ${payload.last}` };
            } catch (err: any) {
                const msg = (err?.message || 'Failed to import').toString();
                return { ok: false, message: msg, studentName: `${payload.first} ${payload.last}` };
            }
        }
    }

    async function tryAttachGuardian(studentId: string, guardian: any) {
        const attempts = [
            { url: `/students/${studentId}/guardians`, body: guardian },
            { url: `/students/${studentId}/parents`, body: guardian },
            { url: `/students/${studentId}/links`, body: { guardian, relationship: guardian.relationship || '' } },
        ];
        for (const a of attempts) {
            try { await api(a.url, { method: 'POST', body: JSON.stringify(a.body) }); break; } catch {}
        }
    }

    async function startImport() {
        if (!hasRequired || rows.length === 0) return;
        setImporting(true);
        setResults([]);
        setProgress(0);

        // Attempt a bulk import first
        const mapped = rows.map(r => {
            const get = (k: MapKey) => {
                const h = mapping[k]; if (!h) return '';
                return String(r[h] ?? '').trim();
            };
            return {
                first: get('first'), last: get('last'),
                grade: get('grade') || null, email: get('email') || null,
                gender: get('gender') || null, pronouns: get('pronouns') || null,
                flags: { iep: coerceBool(get('iep')), ell: coerceBool(get('ell')), medical: coerceBool(get('medical')) },
                guardian: {
                    name: get('guardian_name'), email: get('guardian_email'),
                    phone: get('guardian_phone'), relationship: get('guardian_relationship'),
                },
            };
        });

        const bulkOk = await tryBulkImport({ rows: mapped });
        if (bulkOk) {
            setResults(mapped.map(m => ({ ok: true, message: 'Imported (bulk)', studentName: `${m.first} ${m.last}` })));
            setProgress(100);
            setImporting(false);
            return;
        }

        // Otherwise, do row-by-row with progress
        const out: Result[] = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            // eslint-disable-next-line no-await-in-loop
            const res = await tryCreateStudentAndGuardian(r);
            out.push(res);
            setResults(out.slice());
            setProgress(Math.round(((i + 1) / rows.length) * 100));
        }
        setImporting(false);
    }

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="header-row">
                    <h2 className="title">📥 Import Students & Guardians</h2>
                    <div className="actions">
                        <Link className="btn" href="/students">← Back</Link>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="grid2">
                    {/* LEFT: Upload & Mapping */}
                    <div className="stack-md">
                        <div className="label">1) Upload CSV</div>
                        <div
                            className="drop"
                            onDragOver={e => { e.preventDefault(); }}
                            onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) void handleFile(f); }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
                        >
                            {parsing ? 'Parsing…' : 'Drop CSV here or click to choose'}
                            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} />
                        </div>

                        {headers.length > 0 && (
                            <>
                                <div className="label">2) Map Columns</div>
                                <div className="map-grid">
                                    {[...REQUIRED, ...OPTIONAL].map((k) => (
                                        <div key={k} className="map-row">
                                            <div className="map-key">
                                                {FRIENDLY[k]}{REQUIRED.includes(k) && <span className="req">*</span>}
                                            </div>
                                            <select className="input" value={mapping[k] || ''} onChange={e => headerSelect(k, e.target.value)}>
                                                <option value="">— Not Mapped —</option>
                                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>

                                <div className="chip-row">
                                    <span className="muted">Required: First, Last.</span>
                                    <button className="btn" onClick={() => setMapping(autoMap(headers))}>Auto-map</button>
                                </div>
                            </>
                        )}

                        <div className="actions">
                            <button
                                className="btn btn-primary"
                                onClick={startImport}
                                disabled={!hasRequired || rows.length === 0 || importing}
                            >
                                {importing ? `Importing… ${progress}%` : 'Start Import'}
                            </button>
                        </div>

                        {results.length > 0 && (
                            <div className="results">
                                <div className="label">Results</div>
                                <ul className="result-list">
                                    {results.map((r, i) => (
                                        <li key={i} className={`result ${r.ok ? 'ok' : 'fail'}`}>
                                            <span className="who">{r.studentName || ''}</span>
                                            <span className="msg">{r.message}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Preview */}
                    <div className="stack-md">
                        <div className="label">Preview</div>
                        {rows.length === 0 && <div className="muted">No data yet.</div>}
                        {rows.length > 0 && (
                            <div className="table-wrap">
                                <table className="w-full text-sm">
                                    <thead>
                                    <tr className="text-left text-[var(--muted)]">
                                        {headers.map(h => <th key={h} className="py-2">{h}</th>)}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {preview.map((r, idx) => (
                                        <tr key={idx} className="border-t border-[var(--border)]">
                                            {headers.map(h => <td key={h} className="py-2">{r[h]}</td>)}
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                {rows.length > preview.length && (
                                    <div className="muted mt-2">Showing {preview.length} of {rows.length} rows…</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .muted { color: var(--muted); }
        .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }

        .card { background: var(--panel, #0e122b); border: 1px solid var(--border, #1f2547); border-radius: 14px; padding: 16px; }
        .grid2 { display:grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
        @media (max-width: 1100px) { .grid2 { grid-template-columns: 1fr; } }
        .stack-md { display:flex; flex-direction:column; gap: 12px; }

        .input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 12px;
          color: inherit;
        }

        .drop {
          border: 2px dashed var(--border);
          border-radius: 14px;
          padding: 22px;
          text-align: center;
          cursor: pointer;
          position: relative;
          background: rgba(255,255,255,0.03);
        }
        .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

        .map-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
        @media (max-width: 800px) { .map-grid { grid-template-columns: 1fr; } }
        .map-row { display: contents; }
        .map-key { display:flex; align-items:center; gap:6px; }
        .req { color:#ef4444; margin-left:6px; }

        .table-wrap { overflow-x:auto; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }

        .results { margin-top: 8px; }
        .result-list { display:flex; flex-direction:column; gap:8px; }
        .result { border:1px solid var(--border); border-radius:12px; padding:8px 10px; display:flex; justify-content:space-between; gap:12px; }
        .result.ok { background: rgba(34,197,94,0.08); }
        .result.fail { background: rgba(239,68,68,0.08); }
        .who { font-weight: 600; }
        .msg { opacity: .9; }
      `}</style>
        </div>
    );
}