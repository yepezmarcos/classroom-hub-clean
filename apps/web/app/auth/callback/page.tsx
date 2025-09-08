'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function MagicCallback() {
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = search.get('token');
    if (!token) {
      router.replace('/login?err=missing-token');
      return;
    }
    // Will POST to /api/auth/callback/credentials and then redirect
    signIn('credentials', {
      token,
      redirect: true,
      callbackUrl: '/',
    });
  }, [search, router]);

  return <p style={{ padding: 24 }}>Signing you in…</p>;
}