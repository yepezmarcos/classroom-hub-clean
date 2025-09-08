import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import crypto from 'node:crypto';

@Injectable()
export class ReportsService {
    private openai: OpenAI | null = null;
    constructor(private prisma: PrismaService) {
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }
    }

    async generate(tenantId: string, { studentId, term, tone }: { studentId: string; term: string; tone: 'Formal'|'Encouraging'|'Concise' }) {
        const student = await this.prisma.student.findFirst({ where: { tenantId, id: studentId }});
        if (!student) return { ok:false, error:'Student not found' };

        const grades = await this.prisma.grade.findMany({
            where: { tenantId, studentId },
            take: 100,
            orderBy: { createdAt: 'desc' },
            include: { assignment: true } as any
        });

        const behaviors = await this.prisma.note.findMany({
            where: { tenantId, studentId, tags: { has: 'behavior' } },
            orderBy: { createdAt: 'desc' }, take: 20
        });

        const templates = await this.prisma.commentTemplate.findMany({ where: { tenantId }, take: 30 });

        const summaryLines = grades.slice(0,5).map(g => {
            const title = (g as any)?.assignment?.title || 'Assignment';
            return `${title}: ${g.score ?? '?'} / ${g.outOf ?? '?'}`
        });

        const behaviorBrief = behaviors.slice(0,5).map(b => `• ${b.tags?.find(t=>t!=='behavior') ?? 'Note'} — ${b.body}`).join('\n');

        const prompt = `
Write a ${tone} progress report paragraph for the student below. Be specific but concise.
Student: ${student.first} ${student.last} (grade ${student.grade ?? '?'}, pronouns: ${student.pronouns ?? 'they/them'})
Term: ${term}

Recent grades:
${summaryLines.join('\n') || 'No recent grades'}

Recent behavior notes:
${behaviorBrief || 'No recent notes'}

Comment library (inspirations):
${templates.map(t => `- [${t.category ?? 'general'}] ${t.text}`).join('\n')}

Return only the teacher-facing paragraph. Avoid repeating raw scores; focus on strengths, growth, and next steps.`;

        let text = `(${tone}) ${student.first} shows steady progress. Add more detail once AI key is configured.`;
        if (this.openai) {
            const resp = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4,
            });
            text = resp.choices?.[0]?.message?.content?.trim() || text;
        }
        return { ok: true, draft: text };
    }

    async save(tenantId: string, { studentId, term, content }: { studentId: string; term: string; content: string }) {
        const row = await this.prisma.note.create({
            data: {
                id: crypto.randomUUID(),
                tenantId,
                studentId,
                body: `[${term}] ${content}`,
                tags: ['report','draft'],
            } as any
        });
        return { ok: true, savedId: row.id };
    }
}