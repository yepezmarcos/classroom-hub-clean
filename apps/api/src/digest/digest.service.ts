import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class DigestService {
    constructor(private prisma: PrismaService, private email: EmailService) {}

    async preview(tenantId: string, { studentId, guardianEmail, language }: { studentId: string; guardianEmail?: string; language: 'en'|'es'|'fr' }) {
        const student = await this.prisma.student.findFirst({ where: { tenantId, id: studentId }});
        if (!student) return { ok:false, error:'Student not found' };

        const grades = await this.prisma.grade.findMany({ where: { tenantId, studentId }, take: 5, orderBy: { createdAt: 'desc' }, include: { assignment: true } as any });
        const notes  = await this.prisma.note.findMany({ where: { tenantId, studentId, tags: { has: 'behavior' }}, take: 3, orderBy: { createdAt: 'desc' }});

        const line = (g:any) => `${g?.assignment?.title ?? 'Assignment'}: ${g.score ?? '?'} / ${g.outOf ?? '?'}`;
        const html = `
      <div style="font-family:Inter,system-ui,sans-serif">
        <h2>Weekly Update for ${student.first} ${student.last}</h2>
        <p>Hello${guardianEmail ? '' : ''}, here is a quick snapshot.</p>
        <h3>Recent Grades</h3>
        <ul>${grades.map(line).map(x=>`<li>${x}</li>`).join('') || '<li>No recent grades</li>'}</ul>
        <h3>Behavior Notes</h3>
        <ul>${notes.map(n=>`<li>${(n.tags||[]).filter(t=>t!=='behavior')[0] ?? 'Note'} – ${n.body}</li>`).join('') || '<li>No new notes</li>'}</ul>
        <p style="color:#888">Language: ${language.toUpperCase()} (auto-translate coming next)</p>
      </div>
    `.trim();
        return { ok:true, html };
    }

    async sendNow(tenantId: string, args: { studentId: string; guardianEmail?: string; language: 'en'|'es'|'fr' }) {
        const prev = await this.preview(tenantId, args);
        if (!prev.ok) return prev;
        let recip = args.guardianEmail;

        if (!recip) {
            const link = await this.prisma.studentGuardian.findFirst({
                where: { tenantId, studentId: args.studentId },
                include: { guardian: true } as any
            });
            recip = (link as any)?.guardian?.email || null;
        }
        if (!recip) return { ok:false, error:'No guardian email found' };

        await this.email.sendHtml(recip, `Update for your student`, prev.html);
        return { ok:true, sentTo: recip };
    }
}