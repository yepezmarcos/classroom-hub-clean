'use client';

import { useState, useMemo } from 'react';
import { api } from '../app/lib/api';

type Props = {
  studentId: string;
  assignmentId: string;
  defaultSubject?: string;
  assignmentTitle?: string;
  onSaved?: () => void;
};

function slugify(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export default function AssignmentEvidenceCell({
  studentId,
  assignmentId,
  defaultSubject,
  assignmentTitle,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [subject, setSubject] = useState(defaultSubject || '');
  const [strand, setStrand] = useState('');            // e.g., “Reading – Fluency”
  const [comment, setComment] = useState('');
  const [strengths, setStrengths] = useState('');      // comma-separated keywords
  const [needs, setNeeds] = useState('');              // comma-separated keywords

  const strengthList = useMemo(
    () => strengths.split(',').map(s=>s.trim()).filter(Boolean),
    [strengths]
  );
  const needList = useMemo(
    () => needs.split(',').map(s=>s.trim()).filter(Boolean),
    [needs]
  );

  async function save() {
    if (!studentId || !assignmentId) return;
    const tags = new Set<string>();
    tags.add(`assignment:${assignmentId}`);
    tags.add('comment');
    tags.add('evidence');

    if (subject) tags.add(`subject:${slugify(subject)}`);
    if (strand) tags.add(`strand:${slugify(strand)}`);
    for (const s of strengthList) tags.add(`strength:${slugify(s)}`);
    for (const n of needList) tags.add(`need:${slugify(n)}`);

    const bodyParts: string[] = [];
    if (assignmentTitle || subject || strand) {
      const metaBits = [
        assignmentTitle ? `Assignment: ${assignmentTitle}` : '',
        subject ? `Subject: ${subject}` : '',
        strand ? `Strand: ${strand}` : '',
      ].filter(Boolean);
      if (metaBits.length) bodyParts.push(metaBits.join(' · '));
    }
    if (comment.trim()) bodyParts.push(comment.trim());
    if (strengthList.length) bodyParts.push(`Strengths: ${strengthList.join(', ')}`);
    if (needList.length) bodyParts.push(`Needs: ${needList.join(', ')}`);

    const body = bodyParts.join('\n\n').trim() || 'Evidence added.';

    setSaving(true);
    try {
      await api(`/students/${studentId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body, tags: Array.from(tags) }),
      });
      setOpen(false);
      setComment('');
      setStrand('');
      setStrengths('');
      setNeeds('');
      if (onSaved) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        className="ae-btn"
        title="Add quick evidence/comment"
        onClick={()=>setOpen(true)}
      >
        📝
      </button>

      {open && (
        <div className="ae-overlay" onClick={()=>!saving && setOpen(false)}>
          <div className="ae-card" onClick={(e)=>e.stopPropagation()}>
            <div className="ae-head">
              <div className="ae-title">Assignment Evidence</div>
              <button className="ae-x" onClick={()=>!saving && setOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="ae-grid">
              <div>
                <div className="ae-label">Subject (optional)</div>
                <input
                  className="ae-input"
                  placeholder="e.g., ELA, Math"
                  value={subject}
                  onChange={(e)=>setSubject(e.target.value)}
                />
              </div>

              <div>
                <div className="ae-label">Strand / Unit (optional)</div>
                <input
                  className="ae-input"
                  placeholder="e.g., Reading – Fluency"
                  value={strand}
                  onChange={(e)=>setStrand(e.target.value)}
                />
              </div>

              <div className="ae-full">
                <div className="ae-label">Quick comment</div>
                <textarea
                  className="ae-input"
                  rows={4}
                  placeholder="What did the student demonstrate?"
                  value={comment}
                  onChange={(e)=>setComment(e.target.value)}
                />
              </div>

              <div>
                <div className="ae-label">Strengths (comma-separated)</div>
                <input
                  className="ae-input"
                  placeholder="e.g., participation, organization"
                  value={strengths}
                  onChange={(e)=>setStrengths(e.target.value)}
                />
              </div>

              <div>
                <div className="ae-label">Needs (comma-separated)</div>
                <input
                  className="ae-input"
                  placeholder="e.g., next-steps, fluency"
                  value={needs}
                  onChange={(e)=>setNeeds(e.target.value)}
                />
              </div>
            </div>

            <div className="ae-actions">
              <button className="ae-btn" onClick={()=>setOpen(false)} disabled={saving}>Cancel</button>
              <button className="ae-btn ae-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ae-btn {
          border:1px solid var(--border);
          background: rgba(255,255,255,0.05);
          padding: 6px 10px;
          border-radius: 10px;
        }
        .ae-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
        .ae-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; justify-content: center; align-items: center; z-index: 80;
        }
        .ae-card {
          width: 680px; max-width: calc(100vw - 24px);
          background: #0b1020; border: 1px solid var(--border); border-radius: 14px;
          padding: 14px; box-shadow: 0 14px 32px rgba(0,0,0,.55);
        }
        .ae-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .ae-title { font-weight:700; }
        .ae-x { border:1px solid var(--border); background:transparent; border-radius:10px; padding:4px 8px; }
        .ae-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ae-full { grid-column: 1 / -1; }
        .ae-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
        .ae-input {
          width: 100%; background: rgba(255,255,255,0.05);
          border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; color: inherit;
        }
        .ae-actions { display:flex; justify-content:flex-end; gap:8px; margin-top: 10px; }
      `}</style>
    </>
  );
}