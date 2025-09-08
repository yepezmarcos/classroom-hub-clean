'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { api } from '../lib/api';

type Guardian = { name: string; email?: string|null; phone?: string|null; relationship?: string|null };

// What your table rows use
type StudentRow = {
    id: string;
    first: string; last: string;
    grade?: string|null;
    email?: string|null;
    gender?: string|null;
    pronouns?: string|null;
    iep?: boolean; ell?: boolean; medical?: boolean;
    primaryGuardian?: { name: string; relationship?: string|null; email?: string|null; phone?: string|null } | null;
    moreGuardians?: number;
    courses?: string[];
};

// What the API may return (different shapes supported)
type StudentFromApi = {
    id: string;
    first: string;
    last: string;
    grade?: string | null;
    email?: string | null;
    gender?: string | null;
    pronouns?: string | null;
    iep?: boolean;
    ell?: boolean;
    medical?: boolean;

    // modern summary fields (from updated API list)
    guardianName?: string | null;
    guardianEmail?: string | null;
    guardianPhone?: string | null;
    guardianRelationship?: string | null;
    guardianCount?: number;

    // legacy/expanded shapes
    parents?: Guardian[];
    guardians?: Guardian[];
    links?: { relationship?: string|null; guardian: Guardian }[];
};

const GRADES = ['All','JK','SK','1','2','3','4','5','6','7','8','9','10','11','12'];
const GENDERS = ['All','Male','Female','Nonbinary'];

function autoPronouns(gender?: string|null) {
    switch ((gender||'').toLowerCase()) {
        case 'male': return 'he/him/his';
        case 'female': return 'she/her/her';
        case 'nonbinary': return 'they/them/their';
        default: return '';
    }
}

type ImportState = {
    headers: string[];
    rows: any[]; // raw parsed objects
    map: Record<string, string | null>; // "Header" -> target field id
};

const TARGET_FIELDS = [
    { id:'first', label:'First name*' },
    { id:'last', label:'Last name*' },
    { id:'grade', label:'Grade' },
    { id:'email', label:'Student Email' },
    { id:'gender', label:'Gender' },
    { id:'pronouns', label:'Pronouns' },
    { id:'guardian_name', label:'Guardian Name' },
    { id:'guardian_email', label:'Guardian Email' },
    { id:'guardian_phone', label:'Guardian Phone' },
    { id:'guardian_relationship', label:'Guardian Relationship' },
    { id:'iep', label:'IEP (true/false)' },
    { id:'ell', label:'ELL (true/false)' },
    { id:'medical', label:'Medical (true/false)' },
];

// --- helpers to derive guardians from any backend shape ---
function deriveParentsArray(s: Partial<StudentFromApi> | null | undefined): Guardian[] {
    if (!s) return [];
    if (Array.isArray(s.parents) && s.parents.length) return s.parents;
    if (Array.isArray(s.guardians) && s.guardians.length) return s.guardians;
    if (Array.isArray(s.links) && s.links.length) {
        return s.links
            .map(l => ({
                name: l.guardian?.name ?? '',
                email: l.guardian?.email ?? null,
                phone: l.guardian?.phone ?? null,
                relationship: l.relationship ?? null,
            }))
            .filter(p => p.name || p.email || p.phone);
    }
    return [];
}

function toPrimaryGuardian(s: Partial<StudentFromApi>): StudentRow['primaryGuardian'] {
    const parents = deriveParentsArray(s);
    if (!parents.length) return null;
    const p = parents[0];
    return {
        name: p.name || '',
        relationship: p.relationship ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
    };
}

export default function StudentsPage() {
    const [rows, setRows] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(false);

    // filters
    const [q, setQ] = useState('');
    const [grade, setGrade] = useState('All');
    const [gender, setGender] = useState('All');
    const [fIEP, setFIEP] = useState(false);
    const [fELL, setFELL] = useState(false);
    const [fMedical, setFMedical] = useState(false);

    // selection
    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

    // add drawer
    const [openAdd, setOpenAdd] = useState(false);
    const [first, setFirst] = useState(''); const [last, setLast] = useState('');
    const [sgrade, setSGrade] = useState(''); const [semail, setSEmail] = useState('');
    const [sgender, setSGender] = useState(''); const [spronouns, setSPronouns] = useState('');
    const [iep, setIEP] = useState(false); const [ell, setELL] = useState(false); const [medical, setMedical] = useState(false);
    const [guardian, setGuardian] = useState<Guardian>({ name:'', email:'', phone:'', relationship:'' });

    // import drawer
    const [openImport, setOpenImport] = useState(false);
    const [imp, setImp] = useState<ImportState | null>(null);
    const [importBusy, setImportBusy] = useState(false);
    const [gsUrl, setGsUrl] = useState('');

    function onGenderChange(v: string) {
        setSGender(v);
        if (!spronouns) setSPronouns(autoPronouns(v));
    }

    async function load() {
        setLoading(true);
        try {
            const data: StudentFromApi[] = await api('/students');

            // normalize to include primaryGuardian
            const normalized = (data || []).map((s) => {
                let primary: StudentRow['primaryGuardian'] | null = (s as any).primaryGuardian ?? null;
                if (!primary) primary = toPrimaryGuardian(s);
                if (!primary && (s.guardianName || s.guardianEmail || s.guardianPhone)) {
                    primary = {
                        name: s.guardianName || '',
                        relationship: s.guardianRelationship ?? null,
                        email: s.guardianEmail || null,
                        phone: s.guardianPhone || null,
                    };
                }
                const moreGuardians = Math.max(0, (s.guardianCount ?? 0) - 1);
                return { ...s, primaryGuardian: primary, moreGuardians };
            });

            const shaped: StudentRow[] = normalized.map((s: any) => ({
                id: s.id,
                first: s.first,
                last: s.last,
                grade: s.grade ?? null,
                email: s.email ?? null,
                gender: s.gender ?? null,
                pronouns: s.pronouns ?? null,
                iep: !!s.iep,
                ell: !!s.ell,
                medical: !!s.medical,
                primaryGuardian: s.primaryGuardian ?? null,
                moreGuardians: typeof s.moreGuardians === 'number' ? s.moreGuardians : 0,
                courses: Array.isArray(s.enrollments)
                    ? s.enrollments.map((e: any) => e.classroom?.name).filter(Boolean)
                    : [],
            }));

            setRows(shaped);
            setSelectedIds({}); // reset selection on reload
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        return rows.filter(r => {
            const text = `${r.first} ${r.last} ${r.primaryGuardian?.name || ''} ${r.primaryGuardian?.email || ''}`.toLowerCase();
            if (q && !text.includes(q.toLowerCase())) return false;
            if (grade !== 'All' && (r.grade || '') !== grade) return false;
            if (gender !== 'All') {
                const g = (r.gender || '').toLowerCase();
                if (gender === 'Male' && g !== 'male') return false;
                if (gender === 'Female' && g !== 'female') return false;
                if (gender === 'Nonbinary' && g !== 'nonbinary') return false;
            }
            if (fIEP && !r.iep) return false;
            if (fELL && !r.ell) return false;
            if (fMedical && !r.medical) return false;
            return true;
        });
    }, [rows, q, grade, gender, fIEP, fELL, fMedical]);

    const selectedCount = useMemo(
        () => filtered.reduce((acc, r) => acc + (selectedIds[r.id] ? 1 : 0), 0),
        [filtered, selectedIds]
    );

    function toggleSelectAll() {
        const anyUnchecked = filtered.some(r => !selectedIds[r.id]);
        const next: Record<string, boolean> = { ...selectedIds };
        for (const r of filtered) next[r.id] = anyUnchecked;
        setSelectedIds(next);
    }
    function toggleOne(id: string) {
        setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
    }
    function clearSelection() { setSelectedIds({}); }

    async function save() {
        await api('/students', {
            method: 'POST',
            body: JSON.stringify({
                first, last,
                grade: sgrade || null,
                email: semail || null,
                gender: sgender || null,
                pronouns: spronouns || null,
                iep, ell, medical,
                guardians: guardian.name?.trim() ? [guardian] : [],
            }),
        });
        setFirst(''); setLast(''); setSGrade(''); setSEmail('');
        setSGender(''); setSPronouns(''); setIEP(false); setELL(false); setMedical(false);
        setGuardian({ name:'', email:'', phone:'', relationship:'' });
        setOpenAdd(false);
        await load();
    }

    // ---------- Import (CSV / Google Sheets) ----------
    function parseCsv(text: string) {
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const headers = parsed.meta.fields || [];
        const rows = (parsed.data as any[]).filter(r => Object.values(r).some(v => String(v||'').trim()));
        setImp({ headers, rows, map: {} });
    }

    async function onDropFile(e: React.DragEvent) {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        const text = await f.text();
        parseCsv(text);
    }

    async function fetchGoogleSheetAsCsv(url: string) {
        try {
            const u = new URL(url);
            if (!u.hostname.includes('docs.google.com')) throw new Error('Not a Google Sheets URL');
            const m = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
            if (!m) throw new Error('Invalid Sheets URL');
            const id = m[1];
            const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
            const res = await fetch(exportUrl);
            const text = await res.text();
            parseCsv(text);
        } catch {
            alert('Could not fetch Google Sheets CSV. Please check the link sharing permissions (Anyone with the link).');
        }
    }

    async function autoMapAI() {
        if (!imp) return;
        const res = await fetch('/api/roster/ai-map', {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ headers: imp.headers, sample: imp.rows.slice(0,5) }),
        });
        const j = await res.json();
        const map: Record<string,string|null> = {};
        for (const hdr of imp.headers) map[hdr] = typeof j.map?.[hdr] === 'string' ? j.map[hdr] : null;
        setImp(prev => prev ? { ...prev, map } : prev);
    }

    function toBool(v:any) {
        const s = String(v||'').toLowerCase().trim();
        return ['true','yes','y','1','✓','✔'].some(t => s === t);
    }

    function buildPayloadFromRow(row: any, imp: ImportState) {
        const inv: Record<string, string | null> = {};
        for (const [hdr, field] of Object.entries(imp.map)) if (field) inv[field] = hdr;
        const val = (fid: string) => (inv[fid] ? row[inv[fid] as string] : '');
        const first = String(val('first') || '').trim();
        const last = String(val('last') || '').trim();
        if (!first || !last) return null;

        const gender = String(val('gender') || '').trim().toLowerCase() || null;
        const pronouns = String(val('pronouns') || '').trim() || (autoPronouns(gender || undefined) || null);

        const gname = String(val('guardian_name') || '').trim();
        const guardians = gname ? [{
            name: gname,
            email: String(val('guardian_email')||'').trim() || null,
            phone: String(val('guardian_phone')||'').trim() || null,
            relationship: String(val('guardian_relationship')||'').trim() || null,
        }] : [];

        return {
            first, last,
            grade: String(val('grade') || '').trim() || null,
            email: String(val('email') || '').trim() || null,
            gender, pronouns,
            iep: toBool(val('iep')),
            ell: toBool(val('ell')),
            medical: toBool(val('medical')),
            guardians,
        };
    }

    async function runImport() {
        if (!imp) return;
        setImportBusy(true);
        try {
            let count = 0;
            for (const row of imp.rows) {
                const payload = buildPayloadFromRow(row, imp);
                if (!payload) continue;
                await api('/students', { method: 'POST', body: JSON.stringify(payload) });
                count++;
            }
            alert(`Imported ${count} students`);
            setOpenImport(false); setImp(null); setGsUrl('');
            await load();
        } finally {
            setImportBusy(false);
        }
    }

    // ---------- Utilities (Export / Template / Email) ----------
    function download(filename: string, contents: string, type = 'text/csv;charset=utf-8') {
        const blob = new Blob([contents], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }

    function exportCsvFromList(list: StudentRow[], filename: string) {
        const data = list.map(s => ({
            id: s.id,
            first: s.first,
            last: s.last,
            grade: s.grade || '',
            student_email: s.email || '',
            gender: s.gender || '',
            pronouns: s.pronouns || '',
            iep: s.iep ? 'true' : 'false',
            ell: s.ell ? 'true' : 'false',
            medical: s.medical ? 'true' : 'false',
            guardian_name: s.primaryGuardian?.name || '',
            guardian_relationship: s.primaryGuardian?.relationship || '',
            guardian_email: s.primaryGuardian?.email || '',
            guardian_phone: s.primaryGuardian?.phone || '',
            more_guardians: s.moreGuardians ?? 0,
        }));
        const csv = Papa.unparse(data);
        download(filename, csv);
    }

    function exportFiltered() {
        exportCsvFromList(filtered, `students_filtered_${new Date().toISOString().slice(0,10)}.csv`);
    }
    function exportSelected() {
        const list = filtered.filter(r => selectedIds[r.id]);
        if (list.length === 0) { alert('Select at least one row.'); return; }
        exportCsvFromList(list, `students_selected_${new Date().toISOString().slice(0,10)}.csv`);
    }
    function downloadTemplate() {
        const cols = TARGET_FIELDS.map(t => t.id);
        const csv = Papa.unparse([Object.fromEntries(cols.map(c => [c, '']))], { columns: cols });
        download('students_import_template.csv', csv);
    }

    function emailSelectedGuardians() {
        const emails = filtered
            .filter(r => selectedIds[r.id])
            .map(r => r.primaryGuardian?.email || '')
            .filter(Boolean);
        if (emails.length === 0) { alert('No guardian emails in your selection.'); return; }
        const unique = Array.from(new Set(emails));
        const mailto = `mailto:?bcc=${encodeURIComponent(unique.join(','))}&subject=${encodeURIComponent('Quick update from school')}&body=${encodeURIComponent('Hello,\n\nSharing a quick update.\n\n—')}`;
        window.location.href = mailto;
    }

    function clearFilters() {
        setQ(''); setGrade('All'); setGender('All'); setFIEP(false); setFELL(false); setFMedical(false);
    }

    return (
        <div className="space-y-4">
            {/* Title */}
            <div className="card">
                <div className="title-row">
                    <h2 className="title">👩‍🎓 Students</h2>
                    <div className="title-actions">
                        <span className="muted sub">{rows.length} total</span>
                        <button className="btn" onClick={load}>↻ Refresh</button>
                    </div>
                </div>
            </div>

            {/* Header row with chips/filters */}
            <div className="card">
                <div className="toolbar">
                    <div className="chip-row">
                        <div className="chip-input">
                            <input
                                className="input-compact"
                                placeholder="Search students or guardians…"
                                value={q}
                                onChange={e=>setQ(e.target.value)}
                            />
                        </div>

                        <div className="chip">
                            <span>🎓 Grade</span>
                            <select value={grade} onChange={e=>setGrade(e.target.value)}>
                                {GRADES.map(g=><option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        <div className="chip">
                            <span>⚧ Gender</span>
                            <select value={gender} onChange={e=>setGender(e.target.value)}>
                                {GENDERS.map(g=><option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        <button className={`tag ${fIEP?'on':''}`} onClick={()=>setFIEP(v=>!v)}>🧩 IEP</button>
                        <button className={`tag ${fELL?'on':''}`} onClick={()=>setFELL(v=>!v)}>🗣️ ELL</button>
                        <button className={`tag ${fMedical?'on':''}`} onClick={()=>setFMedical(v=>!v)}>🏥 Medical</button>

                        <button className="tag soft" onClick={clearFilters}>Reset</button>

                        {selectedCount > 0 && (
                            <div className="chip bulk">
                                <span>✅ {selectedCount} selected</span>
                                <button className="btn sm" onClick={emailSelectedGuardians}>📧 Email guardians</button>
                                <button className="btn sm" onClick={exportSelected}>⬇ Export selected</button>
                                <button className="btn sm" onClick={clearSelection}>Clear</button>
                            </div>
                        )}
                    </div>

                    <div className="actions">
                        <button className="btn" onClick={downloadTemplate}>📄 Template CSV</button>
                        <button className="btn" onClick={exportFiltered} disabled={filtered.length===0}>⬇ Export</button>
                        <button className="btn" onClick={()=>setOpenImport(true)}>📥 Bulk Import</button>
                        <button className="btn btn-primary" onClick={()=>setOpenAdd(true)}>＋ Add Student</button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading && <div className="muted">Loading…</div>}
                {!loading && filtered.length === 0 && <div className="muted">No students match the filters.</div>}
                {!loading && filtered.length > 0 && (
                    <div className="table-wrap">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left text-[var(--muted)]">
                                <th className="py-2">
                                    <label className="select-all">
                                        <input
                                            type="checkbox"
                                            checked={filtered.every(r => selectedIds[r.id])}
                                            onChange={toggleSelectAll}
                                        />
                                        <span className="sub">All</span>
                                    </label>
                                </th>
                                <th className="py-2">Name</th>
                                <th>Grade</th>
                                <th>Primary Guardian</th>
                                <th>Contact</th>
                                <th>Flags</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map(s=>(
                                <tr key={s.id} className="border-t border-[var(--border)]">
                                    <td className="py-2">
                                        <input
                                            aria-label="select row"
                                            type="checkbox"
                                            checked={!!selectedIds[s.id]}
                                            onChange={()=>toggleOne(s.id)}
                                        />
                                    </td>
                                    <td className="py-2">
                                        <div className="name">{s.last}, {s.first}</div>
                                        <div className="sub muted">{s.pronouns || s.gender || ''}</div>
                                    </td>
                                    <td>{s.grade || ''}</td>
                                    <td>
                                        {s.primaryGuardian
                                            ? <div>
                                                <div className="name">
                                                    {s.primaryGuardian.name}
                                                    {(s.moreGuardians ?? 0) > 0 ? <span className="muted"> {` (+${s.moreGuardians} more)`}</span> : null}
                                                </div>
                                                <div className="sub">{s.primaryGuardian.relationship || ''}</div>
                                            </div>
                                            : <span className="muted">—</span>}
                                    </td>
                                    <td>
                                        {(s.primaryGuardian?.email || s.primaryGuardian?.phone) ? (
                                            <>
                                                <div className="sub">{s.primaryGuardian?.email || ''}</div>
                                                <div className="sub">{s.primaryGuardian?.phone || ''}</div>
                                            </>
                                        ) : <span className="muted">—</span>}
                                    </td>
                                    <td>
                                        <div className="flag-row">
                                            {s.iep && <span className="flag pill">🧩 IEP</span>}
                                            {s.ell && <span className="flag pill">🗣️ ELL</span>}
                                            {s.medical && <span className="flag pill">🏥 Medical</span>}
                                        </div>
                                    </td>
                                    <td className="text-right">
                                        <Link className="btn" href={`/students/${s.id}`}>View</Link>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                            <tfoot>
                            <tr>
                                <td colSpan={7} className="py-2 sub muted">
                                    Showing {filtered.length} of {rows.length}
                                </td>
                            </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Add drawer */}
            {openAdd && (
                <div className="drawer" onClick={(e)=>{ if (e.target===e.currentTarget) setOpenAdd(false); }}>
                    <div className="drawer-card">
                        <div className="drawer-head">
                            <h3 className="title">Add Student</h3>
                            <button className="btn" onClick={()=>setOpenAdd(false)}>Close</button>
                        </div>

                        <div className="grid3">
                            <div>
                                <div className="label">First</div>
                                <input className="input" value={first} onChange={e=>setFirst(e.target.value)} />
                            </div>
                            <div>
                                <div className="label">Last</div>
                                <input className="input" value={last} onChange={e=>setLast(e.target.value)} />
                            </div>
                            <div>
                                <div className="label">Grade</div>
                                <input className="input" value={sgrade} onChange={e=>setSGrade(e.target.value)} />
                            </div>

                            <div className="col-span-3">
                                <div className="label">Student Email (optional)</div>
                                <input className="input" value={semail} onChange={e=>setSEmail(e.target.value)} />
                            </div>

                            <div>
                                <div className="label">Gender</div>
                                <select className="input" value={sgender} onChange={e=>onGenderChange(e.target.value)}>
                                    <option value="">—</option>
                                    <option>male</option>
                                    <option>female</option>
                                    <option>nonbinary</option>
                                    <option>unspecified</option>
                                </select>
                            </div>
                            <div>
                                <div className="label">Pronouns</div>
                                <input className="input" value={spronouns} onChange={e=>setSPronouns(e.target.value)} placeholder="auto from gender" />
                            </div>

                            <div className="col-span-3">
                                <div className="label">Flags</div>
                                <div className="flag-row">
                                    <label className="flag-check"><input type="checkbox" checked={iep} onChange={e=>setIEP(e.target.checked)} /> 🧩 IEP</label>
                                    <label className="flag-check"><input type="checkbox" checked={ell} onChange={e=>setELL(e.target.checked)} /> 🗣️ ELL</label>
                                    <label className="flag-check"><input type="checkbox" checked={medical} onChange={e=>setMedical(e.target.checked)} /> 🏥 Medical</label>
                                </div>
                            </div>

                            <div className="col-span-3"><h4 className="mt-3 font-semibold">👪 Primary Guardian</h4></div>
                            <div>
                                <div className="label">Name</div>
                                <input className="input" value={guardian.name} onChange={e=>setGuardian(g=>({...g, name:e.target.value}))} />
                            </div>
                            <div>
                                <div className="label">Email</div>
                                <input className="input" value={guardian.email||''} onChange={e=>setGuardian(g=>({...g, email:e.target.value}))} />
                            </div>
                            <div>
                                <div className="label">Phone</div>
                                <input className="input" value={guardian.phone||''} onChange={e=>setGuardian(g=>({...g, phone:e.target.value}))} />
                            </div>
                            <div className="col-span-3">
                                <div className="label">Relationship</div>
                                <input className="input" value={guardian.relationship||''} onChange={e=>setGuardian(g=>({...g, relationship:e.target.value}))} />
                            </div>
                        </div>

                        <div className="drawer-actions">
                            <button className="btn" onClick={()=>setOpenAdd(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={save} disabled={!first.trim() || !last.trim()}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import drawer */}
            {openImport && (
                <div className="drawer" onClick={(e)=>{ if (e.target===e.currentTarget) setOpenImport(false); }}>
                    <div className="drawer-card">
                        <div className="drawer-head">
                            <h3 className="title">Bulk Import</h3>
                            <button className="btn" onClick={()=>setOpenImport(false)}>Close</button>
                        </div>

                        <div className="import-grid">
                            <div className="drop" onDragOver={e=>e.preventDefault()} onDrop={onDropFile}>
                                <div className="drop-inner">
                                    <div className="drop-emoji">📥</div>
                                    <div className="drop-title">Drop CSV here</div>
                                    <div className="drop-sub">or click to pick a file</div>
                                    <input
                                        type="file"
                                        accept=".csv,text/csv"
                                        onChange={async e => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            const text = await f.text();
                                            parseCsv(text);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="or">or</div>

                            <div className="gs">
                                <div className="label">Google Sheets link</div>
                                <input className="input" placeholder="https://docs.google.com/spreadsheets/d/..." value={gsUrl} onChange={e=>setGsUrl(e.target.value)} />
                                <div className="chip-row">
                                    <button className="btn" onClick={downloadTemplate}>📄 Download Template</button>
                                    <button className="btn" onClick={()=>fetchGoogleSheetAsCsv(gsUrl)} disabled={!gsUrl.trim()}>Fetch</button>
                                </div>
                            </div>
                        </div>

                        {imp && (
                            <>
                                <div className="mt-4">
                                    <h4 className="font-semibold mb-2">Map Columns</h4>
                                    <div className="map-grid">
                                        {TARGET_FIELDS.map(tf=>(
                                            <div key={tf.id} className="map-row">
                                                <div className="map-label">{tf.label}</div>
                                                <select
                                                    className="input"
                                                    value={Object.entries(imp.map).find(([hdr,field])=>field===tf.id)?.[0] || ''}
                                                    onChange={e=>{
                                                        const currentHdrForTf = Object.entries(imp.map).find(([_,field])=>field===tf.id)?.[0];
                                                        const nextMap = { ...imp.map };
                                                        if (currentHdrForTf) nextMap[currentHdrForTf] = null;
                                                        const chosenHdr = e.target.value;
                                                        if (chosenHdr) nextMap[chosenHdr] = tf.id;
                                                        setImp({ ...imp, map: nextMap });
                                                    }}
                                                >
                                                    <option value="">—</option>
                                                    {imp.headers.map(h=>(
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 flex gap-8 items-center wrap">
                                        <button className="btn" onClick={autoMapAI}>✨ Auto-map (AI)</button>
                                        <div className="muted">Rows detected: {imp.rows.length}</div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <h4 className="font-semibold mb-2">Preview (first 10)</h4>
                                    <div className="table-wrap">
                                        <table className="w-full text-sm">
                                            <thead>
                                            <tr className="text-left text-[var(--muted)]">
                                                <th>Name</th><th>Grade</th><th>Guardian</th><th>Contact</th><th>Flags</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {imp.rows.slice(0,10).map((r,idx)=>{
                                                const inv: Record<string, string | null> = {};
                                                for (const [hdr, field] of Object.entries(imp.map)) if (field) inv[field] = hdr;
                                                const v = (fid: string) => (inv[fid] ? r[inv[fid] as string] : '');
                                                const first = String(v('first')||'').trim();
                                                const last = String(v('last')||'').trim();
                                                if (!first || !last) {
                                                    return <tr key={idx} className="border-t border-[var(--border)]"><td colSpan={5} className="py-2 muted">Missing first/last — row skipped</td></tr>;
                                                }
                                                const iep = ['true','yes','y','1','✓','✔'].includes(String(v('iep')||'').toLowerCase().trim());
                                                const ell = ['true','yes','y','1','✓','✔'].includes(String(v('ell')||'').toLowerCase().trim());
                                                const medical = ['true','yes','y','1','✓','✔'].includes(String(v('medical')||'').toLowerCase().trim());
                                                return (
                                                    <tr key={idx} className="border-t border-[var(--border)]">
                                                        <td className="py-2">{last}, {first}</td>
                                                        <td>{String(v('grade')||'')}</td>
                                                        <td>{String(v('guardian_name')||'') || '—'}</td>
                                                        <td>
                                                            <div className="sub">{String(v('guardian_email')||'')}</div>
                                                            <div className="sub">{String(v('guardian_phone')||'')}</div>
                                                        </td>
                                                        <td>
                                                            <div className="flag-row">
                                                                {iep && <span className="flag pill">🧩 IEP</span>}
                                                                {ell && <span className="flag pill">🗣️ ELL</span>}
                                                                {medical && <span className="flag pill">🏥 Medical</span>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="drawer-actions">
                                    <button className="btn" onClick={()=>{ setImp(null); setGsUrl(''); }}>Reset</button>
                                    <button className="btn btn-primary" onClick={runImport} disabled={importBusy || !imp.rows.length}>
                                        {importBusy ? 'Importing…' : `Import ${imp.rows.length} students`}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .title-row { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
        .title-actions { display:flex; gap:10px; align-items:center; }
        .muted { color: var(--muted); }
        .sub { font-size: 12px; color: var(--muted); }
        .card { background: var(--panel, #0e122b); border: 1px solid var(--border,#1f2547); border-radius: 14px; padding: 14px; }
        .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .chip-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .chip.bulk { background: rgba(99,102,241,0.10); border-color: rgba(99,102,241,0.50); }
        .chip .btn.sm { padding: 6px 8px; border-radius: 10px; }
        .chip select { background: transparent; color: inherit; border: none; outline: none; }
        .chip-input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .input-compact { width: 320px; max-width: 50vw; background: transparent; border: none; outline: none; color: inherit; }
        .tag { padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.02); }
        .tag.on { background: rgba(99, 102, 241, 0.18); border-color: rgba(99,102,241,.5); }
        .tag.soft { opacity: .9; }
        .actions { display: flex; gap: 8px; align-items:center; flex-wrap: wrap; }

        .table-wrap { overflow-x: auto; }
        .name { font-weight: 600; }
        .flag-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .flag.pill { padding: 2px 8px; border-radius: 9999px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); }

        .select-all { display:flex; align-items:center; gap:6px; }

        .drawer { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: flex-end; z-index: 60; }
        .drawer-card { width: 860px; max-width: 100vw; background: #0b1020; height: 100%; padding: 16px; border-left: 1px solid var(--border); overflow: auto; }
        .drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        @media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } .input-compact { width: 220px; } }
        .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; color: inherit; }
        .flag-check { display: inline-flex; gap: 6px; align-items: center; margin-right: 12px; }
        .drawer-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; flex-wrap: wrap; }

        .import-grid { display: grid; grid-template-columns: 1fr auto 1.2fr; gap: 14px; align-items: center; }
        @media (max-width: 1000px) { .import-grid { grid-template-columns: 1fr; } .or { display:none; } }
        .drop { position: relative; border: 2px dashed var(--border); border-radius: 14px; min-height: 160px; display:flex; align-items:center; justify-content:center; }
        .drop-inner { text-align:center; padding: 20px; position: relative; }
        .drop-emoji { font-size: 40px; margin-bottom: 6px; }
        .drop-title { font-weight:600; margin-bottom: 2px; }
        .drop-sub { font-size: 12px; color: var(--muted); }
        .drop input[type=file] { position:absolute; inset:0; opacity:0; cursor:pointer; }
        .or { color: var(--muted); text-align:center; }
        .gs { display:flex; flex-direction:column; gap:8px; }
        .map-grid { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:10px; }
        @media (max-width:900px) { .map-grid { grid-template-columns: 1fr; } }
        .map-row { display:flex; gap:8px; align-items:center; }
        .map-label { width: 220px; font-size: 13px; color: var(--muted); }
      `}</style>
        </div>
    );
}