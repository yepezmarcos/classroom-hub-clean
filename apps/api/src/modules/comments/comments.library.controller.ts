import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/jwt.guard';

type LibraryItem = {
  id: string;
  text: string;
  category?: string | null;
  level?: 'E' | 'G' | 'S' | 'NS' | null;
  tags: string[];
};

const ON_LS_CATEGORIES = [
  'Responsibility','Organization','Independent Work','Collaboration','Initiative','Self-Regulation'
];

const DEFAULT_OPENERS = [
  '🔹 {First} demonstrates {level} {category}.',
  '🔹 {First} consistently shows {level} {category}.',
  '🔹 {First} is progressing with {level} {category}.',
];

const DEFAULT_CONCLUSIONS = [
  '✨ Next steps include {nextSteps}.',
  '✨ Continued practice with {practice} will support growth.',
  '✨ With targeted feedback in {focus}, further improvement is expected.',
];

@UseGuards(JwtGuard)
@Controller('comments')
export class CommentsLibraryController {
  constructor(private prisma: PrismaService) {}

  @Get('library')
  async library(
    @Req() req: any,
    @Query('type') type: 'learning' | 'subject' = 'learning',
    @Query('jurisdiction') jurisdiction = 'ON',
    @Query('gradeBand') gradeBand?: string,
    @Query('subject') subject?: string,
  ) {
    const { tenantId } = req.user;

    // Pull tenant CommentTemplates, narrow by tags/jurisdiction/grade/subject
    // Tag conventions (recommended):
    //  - 'learning' for learning-skills items
    //  - 'subject'  for subject comments
    //  - level tags: 'E','G','S','NS'
    //  - category tag equals LS category for Ontario
    //  - jurisdiction tag e.g. 'ON'
    const where: any = { tenantId };
    const and: any[] = [];
    if (type === 'learning') and.push({ tags: { has: 'learning' } });
    if (type === 'subject') and.push({ tags: { has: 'subject' } });
    if (jurisdiction) and.push({ tags: { has: jurisdiction } });
    if (gradeBand) and.push({ gradeBand: gradeBand });
    if (subject) and.push({ subject });

    if (and.length) where.AND = and;

    const templates = await this.prisma.commentTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const banks: LibraryItem[] = templates.map((t) => {
      const level = (['E','G','S','NS'] as const).find(L => t.tags?.includes(L)) ?? null;
      const category = ON_LS_CATEGORIES.find(c => t.tags?.includes(c)) ?? t.subject ?? null;
      return {
        id: t.id,
        text: t.text,
        category,
        level,
        tags: t.tags || [],
      };
    });

    // Provide sensible ON defaults if bank is empty
    const defaults: LibraryItem[] = (banks.length ? [] : [
      { id: 'd1', text: '{First} takes responsibility for learning tasks and meets expectations reliably.', category: 'Responsibility', level: 'G', tags: ['learning','ON'] },
      { id: 'd2', text: '{First} collaborates effectively, contributing ideas and supporting peers.', category: 'Collaboration', level: 'G', tags: ['learning','ON'] },
      { id: 'd3', text: '{First} requires reminders to stay organized and submit work on time.', category: 'Organization', level: 'S', tags: ['learning','ON'] },
      { id: 'd4', text: '{First} demonstrates initiative by seeking feedback and acting on it.', category: 'Initiative', level: 'E', tags: ['learning','ON'] },
    ]);

    const openers = DEFAULT_OPENERS;
    const conclusions = DEFAULT_CONCLUSIONS;

    // Learning Skills categories (Ontario) – return for UI convenience
    const categories = ON_LS_CATEGORIES;

    return {
      type,
      jurisdiction,
      openers,
      conclusions,
      categories,
      banks: banks.length ? banks : defaults,
    };
  }
}