// app/lib/guards.ts
export function requireRole(ctx: { role?: string }, allowed: string[]) {
    if (!ctx?.role || !allowed.includes(ctx.role)) {
        const e: any = new Error('Forbidden');
        e.status = 403;
        throw e;
    }
}