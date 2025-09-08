'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const r = await fetch(`${API}/auth/magic/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error('Failed to send link');
      setSent(true);
    } catch (e: any) {
      setErr(e.message || 'Error');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
        {sent ? (
          <p>Check your email for the link. In dev, open <a className="underline" href="http://localhost:8025" target="_blank">MailHog</a>.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@school.org"
              className="w-full border rounded-md px-3 py-2"
              required
            />
            <button className="w-full rounded-md px-3 py-2 bg-black text-white">Send magic link</button>
            {err && <p className="text-red-600 text-sm">{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}