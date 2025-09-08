'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';

// ---------- Types ----------
type Student = { id: string; first: string; last: string; email?: string|null; grade?: string|null };
type Assignment = { id: string; name: string; max: number; category?: string|null; term?: string|null; subject?: string|null };
type Grade = { assignmentId: string; studentId: string; score: number | null };
type GradebookResponse = {
  classroom: { id: string; name: string; code?: string|null; subject?: string|null };
  students: Student[];
  assignments: Assignment[];
  grades: Grade[];
  tenantId?: string | null;
};

type CellKey = `${string}:${string}`;
type BoardKey = 'auto'|'ontario'|'generic';
type CalcMode = 'points'|'weighted';
type OntarioLevel =
  | '4' | '4-' | '3+' | '3' | '3-'
  | '2+' | '2' | '2-'
  | '1+' | '1' | '1-'
  | 'R';

const TENANT_ID = 'default';

// ---------- Quick-pick libraries ----------
const DEFAULT_NAME_OPTIONS = [
  'Quiz 1','Quiz 2','Unit Test','Homework 1','Homework 2','Project',
  'Lab Report','Essay Draft','Presentation','Research Report','Exit Ticket','Checkpoint'
];

const DEFAULT_CATEGORY_OPTIONS = [
  'Test','Quiz','Homework','Classwork','Project','Research','Lab',
  'Essay','Presentation','Participation','Assignment','Exam','Midterm','Final','Checkpoint','Exit Ticket'
];

// ---------- Subject emojis ----------
const SUBJECT_EMOJI: Record<string,string> = (() => {
  const m: Record<string,string> = {
    math:'🧮', algebra:'➗', geometry:'📐', calculus:'∫', statistics:'📊',
    science:'🔬', biology:'🧬', chemistry:'⚗️', physics:'🧲', earth:'🌍',
    computer:'💻', coding:'👩‍💻', technology:'🛠️', engineering:'🧱', robotics:'🤖',
    language:'🗣️', english:'📘', literature:'📚', reading:'📖', writing:'✍️', spelling:'🔤',
    french:'🇫🇷', spanish:'🇪🇸', italian:'🇮🇹', german:'🇩🇪', mandarin:'🇨🇳', japanese:'🇯🇵',
    social:'🌐', history:'🏺', geography:'🗺️', civics:'🏛️', economics:'💹',
    art:'🎨', music:'🎵', drama:'🎭', dance:'🩰', media:'🎥',
    health:'🩺', pe:'🏃', physical:'🏃', wellness:'🧘', nutrition:'🥗',
    business:'💼', accounting:'🧾', marketing:'📣', law:'⚖️',
    careers:'🧭',
  };
  return m;
})();

function emojiForSubject(label?: string|null) {
  const s = (label||'').trim().toLowerCase();
  if (!s) return '📘';
  const parts = s.split(/[ \-/]/g);
  for (const p of [s, ...parts]) {
    if (SUBJECT_EMOJI[p]) return SUBJECT_EMOJI[p];
  }
  for (const key of Object.keys(SUBJECT_EMOJI)) {
    if (s.includes(key)) return SUBJECT_EMOJI[key];
  }
  return '📘';
}

// ---------- Ontario mapping ----------
function ontarioLevelFromPercent(pct: number | null | undefined): OntarioLevel | null {
  if (pct == null || !isFinite(pct)) return null;
  if (pct >= 90) return '4';
  if (pct >= 85) return '4-';
  if (pct >= 78) return '3+';
  if (pct >= 73) return '3';
  if (pct >= 70) return '3-';
  if (pct >= 65) return '2+';
  if (pct >= 60) return '2';
  if (pct >= 57) return '2-';
  if (pct >= 53) return '1+';
  if (pct >= 50) return '1';
  if (pct >= 45) return '1-';
  return 'R';
}

function median(nums: number[]) { if (!nums.length) return null; const a=nums.slice().sort((x,y)=>x-y); const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function clamp(n:number,min:number,max:number){ return Math.max(min, Math.min(max, n)); }

// ---------- helpers: robust settings parsing ----------
function normalizeStringArray(input: any): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  const out = new Set<string>();
  for (const item of arr) {
    if (typeof item === 'string') {
      const v = item.trim();
      if (v) out.add(v);
    } else if (item && typeof item === 'object') {
      const cand = (item.name ?? item.label ?? item.value ?? '').toString().trim();
      if (cand) out.add(cand);
    }
  }
  return Array.from(out);
}
function pickFromMany(obj: any, keys: string[]): string[] {
  for (const k of keys) {
    if (obj?.[k]) {
      const v = normalizeStringArray(obj[k]);
      if (v.length) return v;
    }
  }
  return [];
}
function detectBoardKey(s: any): BoardKey {
  const text = JSON.stringify(s||{}).toLowerCase();
  if (s?.board && String(s.board).toLowerCase().includes('ontario')) return 'ontario';
  if (text.includes('ontario')) return 'ontario';
  return 'generic';
}

// ---------- Smart menu (never clipped) ----------
function useSmartMenu() {
  const [openId, setOpenId] = useState<string|null>(null);
  const [pos, setPos] = useState<{x:number,y:number}|null>(null);
  function openFor(id:string, anchor:HTMLElement|null) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect(); const pad=10;
    const x = clamp(r.left + r.width/2, pad, window.innerWidth-pad);
    const y = clamp(r.bottom + 6, pad, window.innerHeight-pad);
    setOpenId(id); setPos({x,y});
  }
  function close(){ setOpenId(null); setPos(null); }
  useEffect(()=>{
    const esc=(e:KeyboardEvent)=>{ if(e.key==='Escape') close(); };
    const out=(e:MouseEvent)=>{ const el=e.target as HTMLElement; if(el.closest?.('.smart-menu')||el.closest?.('.smart-menu-anchor'))return; close(); };
    window.addEventListener('keydown',esc); window.addEventListener('mousedown',out);
    return ()=>{ window.removeEventListener('keydown',esc); window.removeEventListener('mousedown',out); };
  },[]);
  return { openId, pos, openFor, close };
}

export default function GradebookPage() {
  const params = useParams<{ id: string }>();
  const classId = decodeURIComponent(params.id || '');
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<string|null>(null);

  const [classroom,setClassroom]=useState<GradebookResponse['classroom']|null>(null);
  const [students,setStudents]=useState<Student[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [grid,setGrid]=useState<Record<CellKey,number|null>>({});
  const [saving,setSaving]=useState<Record<CellKey,'saving'|'ok'|'err'|undefined>>({});

  // filters / prefs
  const [calcMode,setCalcMode]=useState<CalcMode>('points');
  const [board,setBoard]=useState<BoardKey>('auto'); // detected from settings; display-only
  const [missingOnly,setMissingOnly]=useState(false);
  const [belowFilter,setBelowFilter]=useState<number|''>('');

  // subjects & terms (STRICTLY from settings)
  const [allSubjects,setAllSubjects]=useState<string[]>([]);
  const [allTerms,setAllTerms]=useState<string[]>([]);
  const [subject,setSubject]=useState<string>('All');
  const [term,setTerm]=useState<string>('All');

  // quick-pick options (names, categories)
  const [nameOptions,setNameOptions]=useState<string[]>([]);
  const [categoryOptions,setCategoryOptions]=useState<string[]>([]);

  // add assignment (selects; Subject is select-only from settings)
  const [newName,setNewName]=useState('');
  const [newNamePick,setNewNamePick]=useState<string>('Custom…');
  const [newMax,setNewMax]=useState<number>(10);
  const [newCat,setNewCat]=useState('');
  const [newCatPick,setNewCatPick]=useState<string>('Custom…');
  const [newTerm,setNewTerm]=useState('');
  const [newTermPick,setNewTermPick]=useState<string>('Custom…');
  const [newSubj,setNewSubj]=useState(''); // kept but unused for input (no custom subject)
  const [newSubjPick,setNewSubjPick]=useState<string>(''); // selected subject from settings

  // AI center
  const [aiOpen,setAiOpen]=useState(false);
  const [aiBusy,setAiBusy]=useState(false);
  const [aiMap,setAiMap]=useState<Record<string,string>>({});
  const [aiMode,setAiMode]=useState<'summaries'|'nextSteps'|'strengths'>('summaries');

  // Report Center
  const [reportOpen,setReportOpen]=useState(false);
  const [reportBusy,setReportBusy]=useState(false);

  const inputsRef = useRef<Record<CellKey,HTMLInputElement|null>>({});
  const colBtnsRef = useRef<Record<string,HTMLButtonElement|null>>({});
  const menu = useSmartMenu();

  function keyOf(sid:string,aid:string):CellKey{ return `${sid}:${aid}`; }
  function getScore(sid:string,aid:string){ return grid[keyOf(sid,aid)] ?? null; }
  function setScoreLocal(sid:string,aid:string,v:number|null){ setGrid(p=>({...p, [keyOf(sid,aid)]:v})); }

  // ------- load gradebook -------
  async function load() {
    setLoading(true); setErr(null);
    try {
      const gb = await api(`/gradebook?classroomId=${encodeURIComponent(classId)}`) as GradebookResponse;
      setClassroom(gb.classroom);
      setStudents(gb.students||[]);
      setAssignments(gb.assignments||[]);
      const g:Record<CellKey,number|null>={};
      for (const row of gb.grades||[]) g[`${row.studentId}:${row.assignmentId}`] = (typeof row.score==='number')?row.score:null;
      setGrid(g);

      // seed quick-pick options (merge defaults + seen)
      const seenNames = Array.from(new Set((gb.assignments||[]).map(a=>a.name).filter(Boolean))) as string[];
      const seenCats  = Array.from(new Set((gb.assignments||[]).map(a=>a.category||'').filter(Boolean))) as string[];
      setNameOptions(Array.from(new Set([...DEFAULT_NAME_OPTIONS, ...seenNames])));
      setCategoryOptions(Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS, ...seenCats])));
    } catch(e:any){ setErr(e?.message||'Failed to load gradebook'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ if(classId) load(); },[classId]);

  // ------- load settings (subjects/terms strictly from settings) + detect board -------
  async function loadSettings() {
    try {
      // Try class-specific first, then global
      let s: any = {};
      try {
        const resClass = await api(`/settings?classroomId=${encodeURIComponent(classId)}`);
        const data = resClass?.data || resClass || {};
        s = { ...s, ...data };
      } catch {}
      try {
        const resGlobal = await api('/settings');
        const data = resGlobal?.data || resGlobal || {};
        s = { ...data, ...s }; // class-specific wins
      } catch {}

      // If settings embed class-specific blocks
      const classScoped =
        s?.classes?.[classId] ||
        s?.byClassroom?.[classId] ||
        s?.classrooms?.[classId] ||
        s?.sections?.[classId] ||
        {};

      const subjFromSettings =
        pickFromMany(classScoped, ['subjects','subjectList','curriculumSubjects']) ||
        pickFromMany(s, ['subjects','subjectList','curriculumSubjects']);

      const termFromSettings =
        pickFromMany(classScoped, ['terms','termList','reportingTerms']) ||
        pickFromMany(s, ['terms','termList','reportingTerms']);

      const subjects = ['All', ...subjFromSettings];
      const terms    = ['All', ...termFromSettings];

      setAllSubjects(subjects);
      setAllTerms(terms);

      // Detect board from settings; display-only
      const detected = detectBoardKey(s);
      if (board==='auto') setBoard(detected);

      // Initialize filters/pickers sensibly
      if (!subjects.includes(subject)) setSubject('All');
      if (!terms.includes(term)) setTerm('All');

      // Default "Add Assignment" subject to first real subject if available
      const firstRealSubject = subjects.find(x=>x!=='All') || '';
      setNewSubjPick(prev => prev || firstRealSubject);

      // Debug if nothing came through (helps during wiring)
      if (subjects.length <= 1) {
        console.warn('No subjects from settings. Check /settings payload shape.');
      }
    } catch (e) {
      console.warn('Failed to load settings; falling back to defaults.', e);
      const fallbackSubjects = ['All','Math','Science','English','History','Art'];
      const fallbackTerms = ['All','T1','T2','T3'];
      setAllSubjects(fallbackSubjects);
      setAllTerms(fallbackTerms);
      if (!fallbackSubjects.includes(subject)) setSubject('All');
      if (!fallbackTerms.includes(term)) setTerm('All');
      setNewSubjPick('Math');
      if (board==='auto') setBoard('generic');
    }
  }
  useEffect(()=>{ loadSettings(); /* eslint-disable-next-line */ },[assignments.length]);

  // ------- derived views -------
  const visibleAssignments = useMemo(()=>{
    return (assignments||[]).filter(a=>{
      // Subject filter strictly from settings value
      const subjOk =
        (subject==='All') ||
        (a.subject && a.subject===subject) ||
        // legacy prefix support
        (/^\s*\[(.+?)\]\s*/.test(a.name||'') && a.name!.toLowerCase().startsWith(`[${subject.toLowerCase()}]`));
      const termOk = (term==='All') || (!a.term) || (a.term===term);
      return subjOk && termOk;
    });
  },[assignments, subject, term]);

  const colStats = useMemo(()=>{
    const out: Record<string, { avg:number|null; med:number|null; count:number }> = {};
    for (const a of visibleAssignments) {
      const vals = students.map(s=>getScore(s.id,a.id)).filter((v):v is number=>typeof v==='number');
      const avg = vals.length ? Math.round((vals.reduce((x,y)=>x+y,0)/vals.length)*10)/10 : null;
      const med = median(vals); out[a.id] = { avg, med: med==null?null:Math.round(med*10)/10, count: vals.length };
    }
    return out;
  },[visibleAssignments, students, grid]);

  const studentTotals = useMemo(()=>{
    const out: Record<string,{ got:number; max:number; pct:number|null; lvl:OntarioLevel|null }> = {};
    for (const s of students) {
      let got=0,max=0;
      for (const a of visibleAssignments) {
        const sc = getScore(s.id,a.id);
        if (typeof sc==='number') got+=sc;
        if (typeof a.max==='number') max+=a.max;
      }
      const pct = max>0? (got/max)*100 : null;
      const b = (board==='auto')?'ontario':board;
      const lvl = b==='ontario' ? ontarioLevelFromPercent(pct) : (pct==null?null:(pct>=80?'4-':pct>=70?'3':pct>=60?'2':pct>=50?'1':'R'));
      out[s.id] = { got:Math.round(got*10)/10, max:Math.round(max*10)/10, pct:pct==null?null:Math.round(pct*10)/10, lvl };
    }
    return out;
  },[students, visibleAssignments, grid, board]);

  const filteredStudents = useMemo(()=>{
    return (students||[]).filter(s=>{
      const t = studentTotals[s.id];
      if (missingOnly) {
        const hasMissing = visibleAssignments.some(a=> (typeof a.max==='number' && a.max>0) && getScore(s.id,a.id)==null);
        if (!hasMissing) return false;
      }
      if (belowFilter!=='' && t.pct!=null && t.pct >= Number(belowFilter)) return false;
      return true;
    });
  },[students, visibleAssignments, studentTotals, missingOnly, belowFilter]);

  // ------- persistence helpers -------
  async function saveCell(studentId:string, assignmentId:string, score:number|null) {
    const k = keyOf(studentId, assignmentId);
    setSaving(p=>({...p,[k]:'saving'}));
    try{
      await api('/grades',{ method:'POST', headers:{'X-Tenant-Id':TENANT_ID}, body: JSON.stringify({ assignmentId, studentId, score }) });
      setSaving(p=>({...p,[k]:'ok'}));
      setTimeout(()=> setSaving(p=>{ const { [k]:_, ...rest } = p; return rest; }),800);
    }catch{
      setSaving(p=>({...p,[k]:'err'}));
    }
  }

  // ------- add assignment (dropdowns with Custom… except Subject) -------
  function resolvePick(pick:string, custom:string){ return pick==='Custom…' ? (custom.trim()||null) : (pick||null); }

  async function addAssignment() {
    const nm = resolvePick(newNamePick, newName);
    if (!nm) return alert('Please enter a name');

    // Subject strictly from settings; no custom subject
    const subj = (newSubjPick && newSubjPick !== 'All') ? newSubjPick : null;

    const payload = {
      classroomId: classId,
      name: nm,
      max: Number(newMax)||10,
      category: resolvePick(newCatPick,newCat),
      term: resolvePick(newTermPick,newTerm),
      subject: subj,
    };
    try{
      const created = await api('/assignments',{
        method:'POST',
        headers:{ 'X-Tenant-Id': TENANT_ID, 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
      });
      setAssignments(prev => [...prev, created as Assignment]);
      // keep last picks for speed, but clear custom text
      setNewName(''); setNewCat(''); setNewTerm('');
    } catch(e:any){ alert(e?.message||'Failed to create assignment'); }
  }

  // ------- column actions -------
  function bumpColumn(aid:string, delta:number) {
    const sids = students.map(s=>s.id);
    sids.forEach((sid)=>{
      const k = keyOf(sid, aid);
      const cur = grid[k];
      if (typeof cur==='number') {
        const next = Math.max(0, cur + delta);
        setScoreLocal(sid, aid, next);
        saveCell(sid, aid, next);
      }
    });
  }
  function setMissingToZero(aid:string) {
    const sids = students.map(s=>s.id);
    sids.forEach(sid=>{
      const k = keyOf(sid, aid);
      const cur = grid[k];
      if (cur==null) { setScoreLocal(sid, aid, 0); saveCell(sid, aid, 0); }
    });
  }
  async function renameAssignment(a:Assignment) {
    const name = prompt('Assignment name', a.name || '') || a.name;
    if (!name || name===a.name) return;
    try {
      const updated = await api(`/assignments/${a.id}`,{
        method:'PATCH',
        headers:{'X-Tenant-Id':TENANT_ID,'Content-Type':'application/json'},
        body: JSON.stringify({ name }),
      });
      setAssignments(prev=> prev.map(x=> x.id===a.id ? (updated as Assignment) : x));
    } catch(e:any){ alert(e?.message||'Rename failed'); }
  }
  async function changeMax(a:Assignment) {
    const txt = prompt('Max points', String(a.max));
    if (!txt) return;
    const max = Number(txt);
    if (!Number.isFinite(max)||max<=0) return alert('Invalid max');
    try {
      const updated = await api(`/assignments/${a.id}`,{
        method:'PATCH',
        headers:{'X-Tenant-Id':TENANT_ID,'Content-Type':'application/json'},
        body: JSON.stringify({ max }),
      });
      setAssignments(prev=> prev.map(x=> x.id===a.id ? (updated as Assignment) : x));
    } catch(e:any){ alert(e?.message||'Update max failed'); }
  }
  async function deleteAssignment(a:Assignment) {
    if (!confirm(`Delete "${a.name}"?`)) return;
    try {
      await api(`/assignments/${a.id}`,{ method:'DELETE', headers:{'X-Tenant-Id':TENANT_ID} });
      setAssignments(prev=> prev.filter(x=> x.id!==a.id));
      setGrid(prev=>{
        const next = { ...prev };
        for (const s of students) delete next[keyOf(s.id,a.id)];
        return next;
      });
    } catch(e:any){ alert(e?.message||'Delete failed'); }
  }

  // ------- AI Center -------
  async function generateAI(mode:'summaries'|'nextSteps'|'strengths'){
    setAiBusy(true);
    const out:Record<string,string> = {};
    for (const s of filteredStudents) {
      const t = studentTotals[s.id]; const p = t?.pct ?? null;
      let text = '';
      try{
        const res = await api('/comments/generate',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            subject: subject==='All' ? classroom?.name || null : subject,
            gradeBand: s.grade || null,
            length:'short', tone:'positive',
            placeholders:['{{student_first}}','{{they}}','{{their}}','{{next_step}}'],
            targetLevel: (board==='ontario' ? (t.lvl || null) : null),
          }),
        });
        text = String(res?.text||'').trim();
      }catch{
        // Simple local fallback
        if (mode==='nextSteps') {
          text = `${s.first} would benefit from setting a weekly goal and using checklists to track progress.`;
        } else if (mode==='strengths') {
          text = `${s.first} shows strong understanding; try peer tutoring or enrichment problems for deeper challenge.`;
        } else {
          if (p==null) text = `${s.first} is building core skills; a clear next step will support steady improvement.`;
          else if (p>=85) text = `${s.first} consistently excels; extend learning with enrichment or leadership opportunities.`;
          else if (p>=70) text = `${s.first} is progressing well; focusing on feedback will help reach the next level.`;
          else if (p>=50) text = `${s.first} shows growth with support; establishing routines will improve outcomes.`;
          else text = `${s.first} needs targeted support; small, specific goals will boost confidence and results.`;
        }
      }
      out[s.id] = text;
    }
    setAiMap(out);
    setAiBusy(false);
    setAiOpen(true);
  }

  async function saveAiToProfiles() {
    const entries = Object.entries(aiMap).filter(([_,v])=>v && v.trim());
    if (!entries.length) return alert('Nothing to save.');
    let ok=0, fail=0;
    for (const [sid, text] of entries) {
      try{
        await api(`/students/${sid}/notes`,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ body: text.trim(), tags:[subject, term,'ai','report-draft'].filter(Boolean) })
        });
        ok++;
      }catch{ fail++; }
    }
    alert(`Saved notes: ${ok}${fail?` | failed: ${fail}`:''}`);
  }

  // ------- Export CSV (respects filters) -------
  function exportCsv() {
    const header = ['Student', ...visibleAssignments.map(a=>`${a.name} (${a.max})`), 'Got', 'Max', 'Percent', 'Level'];
    const lines = [header.join(',')];
    for (const s of filteredStudents) {
      const cells = visibleAssignments.map(a=>{
        const v = getScore(s.id,a.id);
        return (v==null?'':String(v));
      });
      const tot = studentTotals[s.id];
      lines.push([
        `${s.last}, ${s.first}`,
        ...cells,
        tot.got, tot.max, (tot.pct==null?'':tot.pct), (tot.lvl??'')
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${classroom?.name||'class'}-gradebook.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ------- Export PDF (client print) -------
  function exportPdf(summaryOnly=false) {
    const win = window.open('', '_blank');
    if (!win) return alert('Popup blocked');
    const rows = filteredStudents.map(s=>{
      const tot = studentTotals[s.id];
      const pct = tot.pct==null?'—':`${tot.pct}%`;
      const lvl = tot.lvl??'';
      const sub = summaryOnly ? '' : `
        <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12px">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #eee;padding:4px 0">Assignment</th>
              <th style="text-align:right;border-bottom:1px solid #eee;padding:4px 0">Score</th>
            </tr>
          </thead>
          <tbody>
            ${visibleAssignments.map(a=>{
              const v = getScore(s.id,a.id);
              const txt = (v==null?'-':String(v)) + ' / ' + a.max;
              return `<tr><td style="padding:2px 0">${a.name}</td><td style="padding:2px 0;text-align:right">${txt}</td></tr>`;
            }).join('')}
          </tbody>
        </table>`;
      const ai = (aiMap[s.id]||'').trim();
      return `
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:8px 0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${s.first} ${s.last}</strong>${s.grade?` · <span style="color:#6b7280">Grade ${s.grade}</span>`:''}</div>
            <div><strong>${pct}</strong> ${lvl?`<span style="background:#eef2ff;color:#111827;padding:2px 8px;border-radius:999px;margin-left:6px">${lvl}</span>`:''}</div>
          </div>
          <div style="color:#6b7280;margin-top:4px">Total: ${tot.got} / ${tot.max}</div>
          ${sub}
          ${ai?`<div style="margin-top:6px;font-size:12px"><em>${ai}</em></div>`:''}
        </div>`;
    }).join('');
    win.document.write(`
      <html><head><title>${classroom?.name||'Gradebook'} Report</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="font-family:Inter,system-ui,Arial;padding:24px;max-width:900px;margin:0 auto">
        <h2>${emojiForSubject(subject==='All' ? classroom?.subject || classroom?.name : subject)} Gradebook – ${classroom?.name}</h2>
        <div style="color:#6b7280;margin-bottom:12px">${subject} · ${term}</div>
        ${rows || '<p>No students.</p>'}
        <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    win.document.close();
  }

  // ------- UI helpers -------
  function openColMenu(aid:string){ menu.openFor(aid, colBtnsRef.current[aid] || null); }
  function levelBadge(lvl:OntarioLevel|null){
    if (!lvl) return null;
    const palette:Record<OntarioLevel,string> = {
      '4':'#16a34a','4-':'#16a34a',
      '3+':'#84cc16','3':'#84cc16','3-':'#84cc16',
      '2+':'#eab308','2':'#eab308','2-':'#eab308',
      '1+':'#f97316','1':'#f97316','1-':'#f97316',
      'R':'#ef4444',
    };
    return <span className="lvl" style={{background:palette[lvl]}}>{lvl}</span>;
  }

  // quick helper for select+custom
  function SelectWithCustom(props:{
    label:string, valuePick:string, onPick:(v:string)=>void, customValue:string, onCustom:(v:string)=>void, options:string[]
  }) {
    const {label,valuePick,onPick,customValue,onCustom,options} = props;
    return (
      <div className="field">
        <div className="field-label">{label}</div>
        <div className="field-row">
          <select value={valuePick} onChange={e=>onPick(e.target.value)} className="input">
            <option>Custom…</option>
            {options.map(o=> <option key={o} value={o}>{o}</option>)}
          </select>
          {valuePick==='Custom…' && (
            <input
              className="input custom"
              value={customValue}
              onChange={e=>onCustom(e.target.value)}
              placeholder={`Custom ${label.toLowerCase()}`}
            />
          )}
        </div>
      </div>
    );
  }

  // ------- Render -------
  const boardLabel = (board==='ontario' || (board==='auto')) ? 'Ontario' : 'Generic';

  return (
    <div className="page">
      <div className="card head">
        <div className="left">
          <div className="title">
            {emojiForSubject(subject==='All' ? classroom?.subject || classroom?.name : subject)} <strong>Gradebook</strong> — {classroom?.name} <span className="muted">{classroom?.code || ''}</span>
          </div>
          <div className="chips">
            <div className="chip">
              <span>📚 Subject</span>
              <select value={subject} onChange={e=>setSubject(e.target.value)}>
                {allSubjects.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="chip">
              <span>🗓️ Term</span>
              <select value={term} onChange={e=>setTerm(e.target.value)}>
                {allTerms.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {/* Board = display only */}
            <div className="chip">
              <span>🏫 Board</span>
              <span className="board-pill">{boardLabel}</span>
            </div>
            <div className="chip">
              <span>📐 Calc</span>
              <select value={calcMode} onChange={e=>setCalcMode(e.target.value as CalcMode)}>
                <option value="points">Points</option>
                <option value="weighted" disabled>Weighted</option>
              </select>
            </div>
            <label className={`tag ${missingOnly?'on':''}`}><input type="checkbox" checked={missingOnly} onChange={e=>setMissingOnly(e.target.checked)} /> Missing only</label>
            <div className="chip">
              <span>Under %</span>
              <input className="input-mini" type="number" value={belowFilter} onChange={e=>setBelowFilter(e.target.value===''?'':Number(e.target.value))} placeholder="e.g. 70" />
            </div>
          </div>
        </div>
        <div className="right actions">
          <button className="btn" onClick={exportCsv}>⬇️ Export CSV</button>
          <button className="btn" onClick={()=>setReportOpen(true)}>📊 Report Center</button>
          <button className="btn" disabled={aiBusy} onClick={()=>generateAI(aiMode)}>{aiBusy?'Working…':'✨ AI'}</button>
        </div>
      </div>

      {/* Add assignment: dropdowns + custom inputs (Subject = select-only) */}
      <div className="card add">
        <div className="grid-add">
          <SelectWithCustom
            label="Name"
            valuePick={newNamePick}
            onPick={setNewNamePick}
            customValue={newName}
            onCustom={setNewName}
            options={nameOptions}
          />
          <div className="field">
            <div className="field-label">Max</div>
            <input className="input" type="number" min={1} value={newMax} onChange={e=>setNewMax(Number(e.target.value)||10)} />
          </div>
          <SelectWithCustom
            label="Category"
            valuePick={newCatPick}
            onPick={setNewCatPick}
            customValue={newCat}
            onCustom={setNewCat}
            options={categoryOptions}
          />
          <SelectWithCustom
            label="Term"
            valuePick={newTermPick}
            onPick={setNewTermPick}
            customValue={newTerm}
            onCustom={setNewTerm}
            options={allTerms.filter(t=>t!=='All')}
          />
          {/* Subject = settings-only (no custom field) */}
          <div className="field">
            <div className="field-label">Subject</div>
            <div className="field-row">
              <select
                className="input"
                value={newSubjPick}
                onChange={e=>setNewSubjPick(e.target.value)}
              >
                {allSubjects.filter(s=>s!=='All').map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="field" style={{alignSelf:'end'}}>
            <button className="btn btn-primary" onClick={addAssignment}>＋ Add</button>
          </div>
        </div>
      </div>

      <div className="card table-card">
        {loading && <div className="muted">Loading…</div>}
        {err && <div className="err">{String(err)}</div>}
        {!loading && !err && (
          <div className="table-wrap">
            <table className="w-full text-sm gradebook">
              <thead>
                <tr className="text-left text-[var(--muted)]">
                  <th className="py-2 w-56">Student</th>
                  {visibleAssignments.map(a=>(
                    <th key={a.id} className="colhead">
                      <div className="colhead-top">
                        <span className="muted">{a.category || a.subject || ''}</span>
                        <button
                          ref={el=>{ colBtnsRef.current[a.id] = el; }}
                          className="smart-menu-anchor colbtn"
                          onClick={()=>openColMenu(a.id)}
                          title="Assignment menu"
                        >⋯</button>
                      </div>
                      <div className="name">{emojiForSubject(a.subject || a.category)} {a.name}</div>
                      <div className="muted">/ {a.max}</div>
                      <div className="muted tiny">
                        {colStats[a.id]?.avg!=null ? `avg ${colStats[a.id]?.avg}` : '—'}
                        {colStats[a.id]?.med!=null ? ` · med ${colStats[a.id]?.med}` : ''}
                      </div>
                    </th>
                  ))}
                  <th className="w-48 text-right">Totals</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s=>(
                  <tr key={s.id} className="border-t border-[var(--border)]">
                    <td className="py-2">
                      <Link href={`/students/${s.id}`} className="chip-student" title="Open student profile">
                        {s.last}, {s.first}
                      </Link>
                      <div className="sub muted">{s.grade ? `Grade ${s.grade}` : ''}</div>
                    </td>

                    {visibleAssignments.map(a=>{
                      const k = keyOf(s.id,a.id);
                      const val = grid[k];
                      const state = saving[k];
                      return (
                        <td key={a.id} className={`cell ${state==='saving'?'saving':state==='ok'?'ok':state==='err'?'err':''}`}>
                          <input
                            ref={el=>{ inputsRef.current[k]=el; }}
                            className="cell-input"
                            inputMode="decimal"
                            value={val==null ? '' : String(val)}
                            placeholder="—"
                            onChange={e=>{
                              const t = e.target.value.trim();
                              const v = t==='' ? null : Number(t);
                              if (t==='') setScoreLocal(s.id,a.id,null);
                              else if (Number.isFinite(v)) setScoreLocal(s.id,a.id,v);
                            }}
                            onBlur={e=>{
                              const t = e.target.value.trim();
                              const v = t==='' ? null : Number(t);
                              if (t==='') saveCell(s.id,a.id,null);
                              else if (Number.isFinite(v)) saveCell(s.id,a.id, v);
                              else e.target.value = val==null?'':String(val);
                            }}
                            onKeyDown={e=>{
                              if (e.key==='Enter') (e.target as HTMLInputElement).blur();
                              if (e.key==='Escape') (e.target as HTMLInputElement).blur();
                            }}
                          />
                        </td>
                      );
                    })}

                    <td className="text-right">
                      <div className="sum">
                        <div className="sum-col">
                          <div className="sum-label">pts</div>
                          <div className="sum-value"><strong>{studentTotals[s.id]?.got ?? 0}</strong></div>
                        </div>
                        <div className="sum-col">
                          <div className="sum-label">max</div>
                          <div className="sum-value">{studentTotals[s.id]?.max ?? 0}</div>
                        </div>
                        <div className="sum-col">
                          <div className="sum-label">%</div>
                          <div className="sum-value"><strong>{studentTotals[s.id]?.pct ?? '—'}</strong></div>
                        </div>
                        <div className="sum-col">{levelBadge(studentTotals[s.id]?.lvl ?? null)}</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Floating column menu (fixed positioning, never clipped) */}
            {menu.openId && menu.pos && (
              <div
                className="smart-menu"
                style={{ left: menu.pos.x, top: menu.pos.y }}
              >
                {(() => {
                  const a = assignments.find(x=>x.id===menu.openId)!;
                  return (
                    <div className="menu-inner">
                      <div className="menu-title">{a?.name || 'Assignment'}</div>
                      <button className="menu-item" onClick={()=>{ renameAssignment(a); menu.close(); }}>✏️ Rename</button>
                      <button className="menu-item" onClick={()=>{ changeMax(a); menu.close(); }}>🎚️ Change max</button>
                      <hr />
                      <button className="menu-item" onClick={()=>{ bumpColumn(a.id,+1); menu.close(); }}>➕ Curve +1</button>
                      <button className="menu-item" onClick={()=>{ bumpColumn(a.id,-1); menu.close(); }}>➖ Curve −1</button>
                      <button className="menu-item" onClick={()=>{ setMissingToZero(a.id); menu.close(); }}>⛳ Set missing → 0</button>
                      <hr />
                      <button className="menu-item danger" onClick={()=>{ deleteAssignment(a); menu.close(); }}>🗑️ Delete</button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Suggestions modal */}
      {aiOpen && (
        <div className="overlay" onClick={e=>{ if(e.currentTarget===e.target) setAiOpen(false); }}>
          <div className="drawer">
            <div className="drawer-head">
              <h3 className="title">✨ AI Suggestions</h3>
              <div className="row gap">
                <select className="input" value={aiMode} onChange={e=>setAiMode(e.target.value as typeof aiMode)}>
                  <option value="summaries">Summary + next step</option>
                  <option value="nextSteps">Next steps only</option>
                  <option value="strengths">Strengths + extension</option>
                </select>
                <button className="btn" onClick={()=>generateAI(aiMode)} disabled={aiBusy}>{aiBusy?'Working…':'↻ Regenerate'}</button>
                <button className="btn" onClick={saveAiToProfiles}>💾 Save all to profiles</button>
                <button className="btn" onClick={()=>exportPdf(true)}>🖨️ Print summaries</button>
                <button className="btn" onClick={()=>setAiOpen(false)}>Close</button>
              </div>
            </div>
            <div className="ai-list">
              {filteredStudents.map(s=>(
                <div key={s.id} className="ai-item">
                  <div className="ai-student">{s.first} {s.last}</div>
                  <textarea
                    className="input"
                    rows={3}
                    value={aiMap[s.id] || ''}
                    onChange={e=>setAiMap(m=>({...m,[s.id]:e.target.value}))}
                  />
                  <div className="row gap">
                    <button className="btn" onClick={()=>navigator.clipboard.writeText(aiMap[s.id] || '')}>Copy</button>
                    <button
                      className="btn"
                      title="Save to student profile (best-effort as a note)"
                      onClick={async ()=>{
                        const text = (aiMap[s.id]||'').trim(); if (!text) return;
                        try{
                          await api(`/students/${s.id}/notes`,{
                            method:'POST',
                            headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({ body: text, tags:[subject, term,'ai','report-draft'].filter(Boolean) })
                          });
                          alert('Saved to student profile (notes).');
                        }catch{ alert('Could not save; copied to clipboard.'); navigator.clipboard.writeText(text); }
                      }}
                    >💾 Save to profile</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Report Center */}
      {reportOpen && (
        <div className="overlay" onClick={e=>{ if(e.currentTarget===e.target) setReportOpen(false); }}>
          <div className="drawer">
            <div className="drawer-head">
              <h3 className="title">📊 Report Center</h3>
              <div className="row gap">
                <button className="btn" onClick={exportCsv}>⬇️ Download CSV</button>
                <button className="btn" onClick={()=>exportPdf(false)}>🖨️ Print detailed PDF</button>
                <button className="btn" onClick={savePdfSummariesToProfiles} disabled={reportBusy}>💾 Save summaries to profiles</button>
                <button className="btn" onClick={()=>setReportOpen(false)}>Close</button>
              </div>
            </div>
            <div className="muted" style={{marginBottom:8}}>
              Exports respect current filters (Subject/Term, missing/under%). “Save to profiles” stores a note per student.
            </div>
            <div className="ai-list">
              {filteredStudents.map(s=>{
                const t = studentTotals[s.id];
                return (
                  <div key={s.id} className="ai-item">
                    <div className="ai-student">{s.first} {s.last}</div>
                    <div className="sub">Total: <strong>{t.got}/{t.max}</strong> · % <strong>{t.pct ?? '—'}</strong> {levelBadge(t.lvl)}</div>
                    <div className="sub">Assignments in view: {visibleAssignments.length}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page { display:flex; flex-direction:column; gap:14px; }
        .muted { color: var(--muted); }
        .tiny { font-size: 11px; }
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .card { background: var(--panel, #0e122b); border: 1px solid var(--border,#1f2547); border-radius: 14px; padding: 14px; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; align-items:center; }
        .chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border); border-radius:9999px; background:rgba(255,255,255,0.02); }
        .chip select { background:transparent; color:inherit; border:none; outline:none; }
        .board-pill { padding:2px 8px; border:1px solid var(--border); border-radius:9999px; background:rgba(255,255,255,0.03); }
        .input-mini { width:70px; background:transparent; border:1px solid var(--border); border-radius:8px; color:inherit; outline:none; padding:6px 8px; }
        .tag { display:inline-flex; gap:6px; align-items:center; padding:6px 10px; border:1px solid var(--border); border-radius:9999px; }
        .tag.on { background: rgba(99, 102, 241, 0.18); border-color: rgba(99,102,241,.5); }
        .actions { display:flex; gap:8px; }

        .btn { padding:8px 12px; border:1px solid var(--border); border-radius:10px; background:rgba(255,255,255,0.04); }
        .btn-primary { background:#6366f1; border-color:#6366f1; color:white; }

        /* Add assignment form */
        .grid-add {
          display:grid;
          grid-template-columns: 2fr 120px 1.2fr 1.2fr 1.6fr auto;
          gap:14px;
          align-items:end;
        }
        @media (max-width: 1100px){
          .grid-add { grid-template-columns: 1fr 120px 1fr; }
        }
        .field { display:flex; flex-direction:column; gap:8px; }
        .field-label { font-size:12px; color:var(--muted); }
        .field-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .input { width:100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; color: inherit; }
        .field-row .custom { flex:1 1 240px; min-width:200px; margin-top:6px; } /* extra breathing room when stacked */

        .table-wrap { position:relative; overflow:auto; }
        table.gradebook { border-collapse: separate; border-spacing: 0; min-width: 900px; }
        thead th { position: sticky; top: 0; background: var(--panel, #0e122b); z-index: 1; }
        .colhead { min-width: 170px; }
        .colhead-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .colbtn { padding:2px 6px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,0.04); }
        .name { font-weight: 600; }
        .sub { font-size: 12px; color: var(--muted); }
        .chip-student { display:inline-flex; max-width: 100%; border:1px solid var(--border); border-radius:9999px; padding:4px 8px; background:rgba(255,255,255,0.03); text-decoration:none; }
        .cell { padding: 6px; }
        .cell-input { width: 100%; background: rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:8px; padding:6px 8px; color:inherit; }
        .cell.saving .cell-input { outline: 2px solid #6366f1; }
        .cell.ok .cell-input { outline: 2px solid #16a34a; }
        .cell.err .cell-input { outline: 2px solid #ef4444; }

        .sum { display:flex; gap:14px; align-items:center; justify-content:flex-end; }
        .sum-col { display:flex; flex-direction:column; align-items:flex-end; min-width:64px; }
        .sum-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.02em; }
        .sum-value { font-size:15px; font-variant-numeric: tabular-nums; }

        /* Smart menu (fixed; never clipped) */
        .smart-menu { position: fixed; transform: translate(-50%, 0); z-index: 1000; background:#0b1020; border:1px solid var(--border); border-radius:12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); min-width: 220px; }
        .menu-inner { padding:8px; display:flex; flex-direction:column; gap:4px; }
        .menu-title { font-weight:700; margin: 2px 6px 6px; }
        .menu-item { text-align:left; padding:8px 10px; border-radius:8px; border:1px solid transparent; background:transparent; }
        .menu-item:hover { background: rgba(255,255,255,0.06); border-color: var(--border); }
        .menu-item.danger:hover { background: rgba(239,68,68,0.15); border-color: #ef4444; }

        /* Modal/drawer */
        .overlay { position:fixed; inset:0; background: rgba(0,0,0,0.5); display:flex; align-items:stretch; justify-content:flex-end; z-index: 900; }
        .drawer { width: 920px; max-width: 100vw; background: #0b1020; height: 100%; padding: 16px; border-left: 1px solid var(--border); overflow:auto; }
        .drawer-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:10px; }

        .ai-list { display:grid; grid-template-columns: 1fr; gap:12px; }
        .ai-item { border:1px solid var(--border); border-radius:12px; padding:10px; background: rgba(255,255,255,0.02); }
        .ai-student { font-weight:700; margin-bottom:6px; }

        .row.gap { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .err { color: #ef4444; }
        .lvl { display:inline-flex; align-items:center; justify-content:center; font-weight:700; color:#000; padding: 0 8px; border-radius: 999px; margin-left:8px; }
      `}</style>
    </div>
  );
}