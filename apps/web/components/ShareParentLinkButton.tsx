'use client';

import { useState } from 'react';

export default function ShareParentLinkButton({ studentId }: { studentId: string }) {
    const [open, setOpen] = useState(false);
    const [hours, setHours] = useState(72);
    const [link, setLink] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function createLink() {
        try {
            setBusy(true); setErr(null);
            const r = await fetch('/api/parent/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, hours }) });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || 'Failed');
            setLink(j.url);
        } catch (e: any) {
            setErr(e?.message || 'Failed');
        } finally {
            setBusy(false);
        }
    }

    async function copy() {
        if (!link) return;
        try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(()=>setCopied(false), 1200); } catch {}
    }

    return (
        <div className="wrap">
            <button className="btn" onClick={()=>setOpen(v=>!v)}>🔗 Share Parent Link</button>
            {open && (
                <div className="panel">
                    <div className="row">
                        <label>Expires in</label>
                        <select value={hours} onChange={e=>setHours(parseInt(e.target.value,10))}>
                            <option value={24}>24 hours</option>
                            <option value={72}>3 days</option>
                            <option value={168}>7 days</option>
                            <option value={720}>30 days</option>
                        </select>
                    </div>

                    <div className="row">
                        <button className="btn btn-primary" onClick={createLink} disabled={busy}>{busy ? 'Creating…' : 'Create link'}</button>
                        {err && <span className="err">{err}</span>}
                    </div>

                    {link && (
                        <div className="row">
                            <input className="input" readOnly value={link} />
                            <button className="btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
        .wrap { position: relative; display:inline-block; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:8px 10px; border-radius:10px; }
        .btn-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
        .panel { position:absolute; right:0; top:110%; width:min(420px, 92vw); z-index:20;
          border:1px solid var(--border); border-radius:12px; background: var(--panel,#0e122b); padding:10px; box-shadow:0 10px 40px rgba(0,0,0,.45); }
        .row { display:flex; gap:8px; align-items:center; margin:8px 0; }
        label { font-size:12px; color: var(--muted); }
        select,.input { flex:1; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:10px; padding:8px 10px; color:inherit; }
        .err { color:#ff9c9c; font-size:12px; }
      `}</style>
        </div>
    );
}