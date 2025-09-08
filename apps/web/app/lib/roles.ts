'use client';

import { useEffect, useState } from 'react';

type Session = {
    user?: { name?: string | null; email?: string | null; role?: string | null; roles?: string[] | null } | null;
};

export function useUser() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let on = true;
        fetch('/api/auth/session')
            .then(r => r.ok ? r.json() : null)
            .then(j => { if (on) { setSession(j || {}); setLoading(false); } })
            .catch(() => { if (on) { setSession({}); setLoading(false); } });
        return () => { on = false; };
    }, []);

    const roles = (session?.user?.roles || (session?.user?.role ? [session.user.role] : [])) as string[];
    return { user: session?.user || null, roles, loading };
}

export function hasAnyRole(roles: string[] | undefined, allowed: string[]) {
    if (!allowed.length) return true;
    if (!roles || !roles.length) return false;
    return roles.some(r => allowed.includes(r));
}

export function RequireRole({
                                allow = [],
                                children,
                                fallback = null,
                            }: {
    allow?: string[];
    children: any;
    fallback?: any;
}) {
    const { roles, loading } = useUser();
    if (loading) return null;
    return hasAnyRole(roles, allow) ? children : fallback;
}