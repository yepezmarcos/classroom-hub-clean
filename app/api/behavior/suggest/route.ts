// app/api/behavior/suggest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

export async function POST(req: NextRequest) {
    const { studentId, days = 14 } = await req.json();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const notes = await prisma.note.findMany({
        where: {
            studentId,
            createdAt: { gte: since },
            tags: { hasSome: ['behavior', 'incident'] } // handle array<string> in Prisma schema
        },
        orderBy: { createdAt: 'desc' }
    });

    // simple counts by tag keyword
    const lower = (s: string) => (s || '').toLowerCase();
    const disruptions = notes.filter(n => n.tags?.some(t => lower(t).includes('disruption') || lower(t).includes('off-task')));
    const kindness = notes.filter(n => n.tags?.some(t => lower(t).includes('kindness') || lower(t).includes('positive')));

    const suggestions: string[] = [];

    if (disruptions.length >= 3) {
        suggestions.push('⚠️ 3+ disruptions in the last 14 days. Suggest: small-group activity and parent note.');
    }
    if (kindness.length >= 2) {
        suggestions.push('🎉 Multiple positive incidents—send a quick celebration note to guardians.');
    }
    if (notes.length === 0) {
        suggestions.push('No incidents logged—consider quick spot-check this week.');
    }

    return NextResponse.json({ count: notes.length, suggestions });
}