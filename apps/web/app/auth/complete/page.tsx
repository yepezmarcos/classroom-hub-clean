'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CompletePage() {
  const router = useRouter();
  const ok = useSearchParams().get('ok') === '1';

  useEffect(() => {
    // The API verify endpoint already set the cookie.
    // Here we can fetch /me or just go to dashboard.
    const timer = setTimeout(() => router.replace('/'), 600);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2">{ok ? 'Signed in ✅' : 'Almost there…'}</h1>
        <p>Redirecting you to your dashboard…</p>
      </div>
    </div>
  );
}