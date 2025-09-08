import { useMemo, useState } from 'react';

type Note = {
  id: string;
  body: string;
  tags: string[];
  createdAt: string;
  author?: { name?: string | null; email?: string | null };
};

type Props = {
  notes: Note[];
  subjectId?: string;
  onInsert: (text: string) => void;
  maxItems?: number; // optional: default 50
};

function matchesSubject(n: Note, subjectId?: string) {
  if (!subjectId) return true;
  const subj = subjectId.toLowerCase();
  const tags = (n.tags || []).map(t => t.toLowerCase());
  // tag match (preferred)
  if (tags.includes(`subject:${subj}`)) return true;
  // soft match as fallback
  return (n.body || '').toLowerCase().includes(subj);
}

function firstSentence(s: string) {
  const t = (s || '').trim().replace(/\s+/g, ' ');
  const m = t.match(/(.+?[\.!\?])\s|$/);
  const sent = m ? (m[1] || t) : t;
  // keep it concise for insertion
  return sent.length > 240 ? sent.slice(0, 240) + '…' : sent;
}

export default function RecentEvidence({ notes, subjectId, onInsert, maxItems = 50 }: Props) {
  const [days, setDays] = useState<7 | 30 | 0>(7); // 0 = all
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : 0;
    return (notes || [])
      .filter(n => !cutoff || new Date(n.createdAt).getTime() >= cutoff)
      .filter(n => matchesSubject(n, subjectId))
      .filter(n => !q.trim() || n.body.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, maxItems);
  }, [notes, subjectId, days, q, maxItems]);

  return (
    <div className="ev">
      <div className="evHead">
        <div className="evTitle">Recent Evidence</div>
        <div className="evTools">
          <div className="chip-row">
            <button
              className={`btn evChip ${days===7 ? 'on':''}`}
              onClick={()=>setDays(7)}
              title="Last 7 days"
            >7d</button>
            <button
              className={`btn evChip ${days===30 ? 'on':''}`}
              onClick={()=>setDays(30)}
              title="Last 30 days"
            >30d</button>
            <button
              className={`btn evChip ${days===0 ? 'on':''}`}
              onClick={()=>setDays(0)}
              title="All time"
            >All</button>
          </div>
          <div className="chip evSearch">
            <input
              className="input bare"
              placeholder="Search evidence…"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="evList">
        {filtered.length === 0 && (
          <div className="muted">No recent evidence.</div>
        )}
        {filtered.map(n => {
          const when = new Date(n.createdAt).toLocaleString();
          const excerpt = n.body.length > 260 ? n.body.slice(0, 260) + '…' : n.body;
          const sentence = firstSentence(n.body);
          return (
            <div key={n.id} className="evItem">
              <div className="evMeta">
                <span className="evWhen">{when}</span>
                {(n.tags?.length ? <span className="evTags">{n.tags.join(', ')}</span> : null)}
              </div>
              <div className="evBody">{excerpt}</div>
              <div className="evActions">
                <button className="btn" onClick={()=>onInsert(sentence)}>Insert</button>
                <button className="btn" onClick={()=>onInsert(n.body)}>Insert Full</button>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .ev { border: 1px solid var(--border); border-radius: 14px; background: rgba(255,255,255,0.03); }
        .evHead {
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding: 12px 12px 10px; border-bottom: 1px solid var(--border);
        }
        .evTitle { font-weight: 700; }
        .evTools { display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
        .evChip { padding: 6px 10px; border-radius: 9999px; }
        .evSearch { padding: 6px 10px; }

        .evList {
          max-height: 360px; overflow:auto; padding: 10px 12px; display:flex; flex-direction:column; gap: 10px;
        }
        .evItem {
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 10px 12px;
          display:flex; flex-direction:column; gap: 8px;
        }
        .evMeta { display:flex; gap:10px; flex-wrap:wrap; font-size:12px; color: var(--muted); }
        .evWhen { opacity:.9; }
        .evTags { opacity:.8; }
        .evBody { white-space:pre-wrap; line-height:1.42; }
        .evActions { display:flex; gap:8px; }
      `}</style>
    </div>
  );
}