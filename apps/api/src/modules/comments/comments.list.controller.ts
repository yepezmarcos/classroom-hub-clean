import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('comments')
export class CommentsListController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('tags') tags?: string,
    @Query('subject') subject?: string,
    @Query('gradeBand') gradeBand?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const { tenantId } = req.user;
    const tagList = (tags || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const take = Math.max(1, Math.min(Number(limit) || 200, 500));

    // Basic “contains” text search (DB-agnostic). If you later move to Postgres full-text, we can upgrade this.
    const where: any = {
      tenantId,
      ...(subject ? { subject } : {}),
      ...(gradeBand ? { gradeBand } : {}),
      ...(tagList.length ? { tags: { hasSome: tagList } } : {}),
      ...(q?.trim()
        ? {
            text: {
              contains: q.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };

    return this.prisma.commentTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, text: true, subject: true, gradeBand: true, tags: true },
    });
  }
}