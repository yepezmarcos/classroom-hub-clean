'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function ParentPortalLanding() {
    const [token, setToken] = useState('');
    const router = useRouter();

    function go(e: React.FormEvent) {
        e.preventDefault();
        if (!token.trim()) return;
        router.push(`/parent/${encodeURIComponent(token.trim())}`);
    }

    return (
        <div className="wrap">
            <div className="head">
                <h1 className="title">Parent Portal</h1>
                <Link className="btn" href="/dashboard">← Back to Dashboard</Link>
            </div>

            <div className="card">
                <p className="muted">
                    Enter the secure access code you received from your school to view your student’s
                    recent attendance and teacher comments.
                </p>
                <form onSubmit={go} className="form">
                    <label>Access Code</label>
                    <input
                        className="input"
                        value={token}
                        onChange={(e)=>setToken(e.target.value)}
                        placeholder="e.g., 9K2F-ABCD"
                    />
                    <button className="btn btn-primary" type="submit" disabled={!token.trim()}>View Student</button>
                </form>
                <p className="muted small">Having trouble? Contact the school office to confirm your code.</p>
            </div>

            <style jsx>{`
        .wrap { max-width: 720px; margin: 0 auto; padding: 16px; }
        .head { display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; }
        .title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
        .card { border: 1px solid var(--border); border-radius: 14px; padding: 12px; background: rgba(255,255,255,0.03); }
        .form { display:flex; gap:10px; align-items:center; }
        label { font-size:12px; color: var(--muted); }
        .input { flex:1; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px 12px; color:inherit; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; white-space:nowrap; }
        .btn-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
        .muted { color: var(--muted); }
        .small { font-size: 12px; margin-top: 8px; }
      `}</style>
        </div>
    );
}