'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import AssignmentEvidenceCell from '../../components/AssignmentEvidenceCell';

type Student = { id: string; first: string; last: string };
type Assignment = { id: string; title: string; subject?: string | null; date?: string | null };

export default function GradebookPage() {
  // You might already control this with your own UI; this demo picks first classroom if available.
  const [classroomId, setClassroomId] = useState<string>('');
  const [classrooms, setClassrooms] = useState<{ id:string; name:string }[]>([]);

  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Local score state (demo only). Replace with your real save/load if you have it.
  const [scores, setScores] = useState<Record<string, string>>({}); // key: `${studentId}:${assignmentId}`

  /* ========== Loads ========== */

  useEffect(() => {
    (async ()=>{
      // Classrooms (optional)
      const cl = await safe(`/classrooms`);
      if (Array.isArray(cl) && cl.length) {
        setClassrooms(cl.map((c:any)=>({id:c.id, name:c.name})));
        setClassroomId(cl[0].id);
      } else {
        setClassrooms([{ id:'demo', name:'Demo Class' }]);
        setClassroomId('demo');
      }
    })();
  }, []);

  useEffect(() => {
    (async ()=>{
      if (!classroomId) return;

      // Students in classroom
      const s = await safe(`/classrooms/${classroomId}/students`);
      if (Array.isArray(s) && s.length) {
        setStudents(s.map((x:any)=>({ id:x.id, first:x.first, last:x.last })));
      } else {
        setStudents([
          { id: 'stu-1', first: 'Avery', last: 'Lee' },
          { id: 'stu-2', first: 'Jordan', last: 'Ng' },
          { id: 'stu-3', first: 'Sam', last: 'Patel' },
        ]);
      }

      // Assignments
      const a = await safe(`/classrooms/${classroomId}/assignments`);
      if (Array.isArray(a) && a.length) {
        setAssignments(a.map((x:any)=>({
          id:x.id, title:x.title || 'Assignment',
          subject:x.subject || null, date:x.date || null
        })));
      } else {
        setAssignments([
          { id: 'a1', title: 'Reading Fluency', subject:'ELA', date:'2025-09-01' },
          { id: 'a2', title: 'Number Sense Quiz', subject:'Math', date:'2025-09-06' },
          { id: 'a3', title: 'Science Lab Report', subject:'Science', date:'2025-09-12' },
        ]);
      }
    })();
  }, [classroomId]);

  // If you filter by a subject globally, you can pass it down. We'll keep undefined so the cell uses its col.subject.
  const currentSubject = useMemo(()=> undefined as string | undefined, []);

  /* ========== Score helpers (demo) ========== */
  function keyFor(stuId:string, asgId:string) { return `${stuId}:${asgId}`; }
  function getScore(stuId:string, asgId:string) { return scores[keyFor(stuId, asgId)] || ''; }
  function setScore(stuId:string, asgId:string, v:string) {
    const k = keyFor(stuId, asgId);
    setScores(prev => ({ ...prev, [k]: v }));
    // If you have a real endpoint, save here:
    // void api(`/gradebook/scores`, { method:'POST', body: JSON.stringify({ studentId: stuId, assignmentId: asgId, score: v }) });
  }

  function refresh() {
    // Optional hook if you want to reload something after saving evidence.
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="header-row">
          <h2 className="title">📊 Gradebook</h2>
          <div className="actions">
            <div className="chip">
              <span>Classroom</span>
              <select value={classroomId} onChange={e=>setClassroomId(e.target.value)}>
                {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="card">
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="py-2">Student</th>
                {assignments.map(a => (
                  <th key={a.id} className="py-2">
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span>{a.title}</span>
                      {a.subject && <span className="pill">{a.subject}</span>}
                      {a.date && <span className="muted">{new Date(a.date).toLocaleDateString()}</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="py-2">{row.last}, {row.first}</td>
                  {assignments.map((col) => (
                    <td key={col.id}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        {/* Your score field — keep your own if you already have one */}
                        <input
                          className="score"
                          value={getScore(row.id, col.id)}
                          onChange={(e)=>setScore(row.id, col.id, e.target.value)}
                          placeholder="—"
                        />
                        {/* 📝 Quick evidence — SAVE to /students/:id/notes with helpful tags */}
                        <AssignmentEvidenceCell
                          studentId={row.id}
                          assignmentId={col.id}
                          assignmentTitle={col.title}
                          defaultSubject={currentSubject || col.subject || undefined}
                          onSaved={() => refresh()}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              {students.length===0 && (
                <tr><td colSpan={1+assignments.length}><div className="muted">No students.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .muted { color: var(--muted); }
        .card { background: var(--panel, #0e122b); border: 1px solid var(--border, #1f2547); border-radius: 14px; padding: 16px; }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }
        .chip { display:inline-flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); }
        .table-wrap { overflow-x:auto; }
        .pill { font-size: 11px; padding: 2px 8px; border:1px solid var(--border); border-radius: 9999px; background: rgba(255,255,255,0.06); }
        .score { width: 68px; text-align: center; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; color: inherit; }
      `}</style>
    </div>
  );
}

async function safe(url: string, init?: RequestInit) {
  try { return await api(url, init); } catch { return null; }
}