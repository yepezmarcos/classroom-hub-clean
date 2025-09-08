import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('comments-extra')
export class CommentsExtraController {
  constructor(private prisma: PrismaService) {}

  // Existing seeder remains — keep your current Ontario seeding as-is
  @Post('seed/ontario')
  async seedOntario(@Req() req: any) {
    const { tenantId } = req.user;
    // idempotent seed example (simplified)
    const samples = [
      { text: 'Demonstrates strong responsibility by completing tasks on time.', tags: ['learning','ontario','responsibility','E'] },
      { text: 'Usually organized; benefits from checklists and reminders.', tags: ['learning','ontario','organization','G'] },
      { text: 'Collaborates well with peers and contributes to group goals.', tags: ['learning','ontario','collaboration','E'] },
      // ...
    ];
    for (const s of samples) {
      await this.prisma.commentTemplate.upsert({
        where: { // crude dedupe by text + tenant
          id: `${tenantId}_${Buffer.from(s.text).toString('base64').slice(0,24)}`
        },
        create: {
          id: `${tenantId}_${Buffer.from(s.text).toString('base64').slice(0,24)}`,
          tenantId,
          text: s.text,
          tags: s.tags,
        },
        update: {},
      });
    }
    return { ok: true };
  }

  @Post('compose')
  async compose(@Req() req: any, @Body() body: any) {
    const { tenantId } = req.user;

    // Pull tenant settings (jurisdiction, terms, categories, etc.)
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = t?.settings || {};

    const {
      mode = 'learning',          // 'learning' | 'subject'
      studentId,
      term = 'T1',
      category = 'responsibility',
      level = 'G',                // E | G | S | N
      subject = null,
      pieces = {},
    } = body || {};

    // Optional: fetch student for pronouns/name context if needed later
    const student = studentId
      ? await this.prisma.student.findFirst({ where: { id: studentId, tenantId } })
      : null;

    // Filter comment bank by jurisdiction when present
    const where: any = { tenantId };
    if (settings?.jurisdiction) {
      where.tags = { has: settings.jurisdiction };
    }
    const templates = await this.prisma.commentTemplate.findMany({
      where,
      take: 200,
    });

    // super-simple builder: pick 1–2 lines matching category/level if possible
    const pool = templates.filter(t =>
      (t.tags || []).some((tag: string) =>
        [category, level, mode, settings?.jurisdiction].filter(Boolean).some(k =>
          (tag || '').toLowerCase() === String(k).toLowerCase()
        )
      )
    );

    const chosen = pool.slice(0, 2).map(t => t.text);
    const opener = pieces.opener || chosen[0] || '';
    const evidence = pieces.evidence ? ` ${pieces.evidence}` : '';
    const next = pieces.nextSteps ? ` Next, ${pieces.nextSteps}` : '';
    const conclusion = pieces.conclusion ? ` ${pieces.conclusion}` : '';

    const text = [opener, evidence, next, conclusion].join('').trim();
    return { text, meta: { usedJurisdiction: settings?.jurisdiction || null } };
  }
}