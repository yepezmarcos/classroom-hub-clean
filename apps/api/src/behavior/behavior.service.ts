import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'node:crypto';

@Injectable()
export class BehaviorService {
    constructor(private prisma: PrismaService) {}

    async log(tenantId: string, data: { studentId: string; tag: string; note?: string; occurredAt?: string }) {
        const when = data.occurredAt ? new Date(data.occurredAt) : new Date();
        const body = data.note?.trim() || data.tag;
        const row = await this.prisma.note.create({
            data: {
                id: crypto.randomUUID(),
                tenantId,
                studentId: data.studentId,
                body,
                tags: ['behavior', data.tag],
                createdAt: when,
            } as any
        });
        return { ok: true, row };
    }

    async timeline(tenantId: string, studentId: string) {
        const rows = await this.prisma.note.findMany({
            where: { tenantId, studentId, tags: { has: 'behavior' } },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return { ok: true, rows };
    }

    async suggestions(tenantId: string, studentId: string) {
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const disruptions = await this.prisma.note.count({
            where: { tenantId, studentId, tags: { hasEvery: ['behavior','Disruption'] }, createdAt: { gte: since } }
        });
        const ideas: string[] = [];
        if (disruptions >= 3) {
            ideas.push('⚠️ 3+ disruptions in last 14 days → try small-group activity + front-load expectations; consider quick parent note.');
        }
        return { ok: true, suggestions: ideas };
    }
}