// apps/api/src/modules/comments/comments.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type UpsertTemplateDto = {
  text: string;
  tags?: string[];
  subject?: string | null;
  gradeBand?: string | null;
  topic?: string | null;
};

@Controller('comments')
export class CommentsListController {
  constructor(private prisma: PrismaService) {}

  /** Resolve tenant id: user → header → env (safe). */
  private resolveTenantId(req: any): string {
    const fromUser = req?.user?.tenantId;
    const h = (req?.headers || {}) as Record<string, string | string[] | undefined>;
    const rawHeader = h['x-tenant-id'] ?? h['x-tenantid'] ?? (h['x_tenant_id'] as any);
    const fromHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const fromEnv = process.env.DEFAULT_TENANT_ID;
    const tenantId = (fromUser || fromHeader || fromEnv || '').trim();
    return tenantId;
  }

  /** GET /comments?search=&jurisdiction=&type=&limit= */
  @Get()
  async list(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('jurisdiction') jurisdiction?: string,
    @Query('type') type?: 'learning' | 'email' | 'subject',
    @Query('limit') limitStr?: string,
  ) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    const limit = Math.min(Math.max(parseInt(String(limitStr || '500'), 10) || 500, 1), 2000);

    // Build where
    const where: any = { tenantId };
    if (jurisdiction) {
      where.tags = { hasEvery: [jurisdiction.toLowerCase()] };
    }
    if (type === 'learning') {
      where.tags = where.tags
        ? { hasEvery: [...where.tags.hasEvery, 'learning'] }
        : { hasEvery: ['learning'] };
    } else if (type === 'email') {
      // include 'email' OR any topic:* OR template:email
      where.OR = [
        { tags: { has: 'email' } },
        { tags: { hasSome: ['template:email', 'email-template'] } },
      ];
    } else if (type === 'subject') {
      where.tags = where.tags
        ? { hasEvery: [...where.tags.hasEvery, 'subject'] }
        : { hasEvery: ['subject'] };
    }

    if (search && search.trim()) {
      return this.prisma.commentTemplate.findMany({
        where: {
          ...where,
          OR: [
            { text: { contains: search, mode: 'insensitive' } },
            { subject: { contains: search, mode: 'insensitive' } },
            { tags: { has: search.toLowerCase() } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
      });
    }

    return this.prisma.commentTemplate.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
  }

  /** POST /comments  (create) */
  @Post()
  async create(@Req() req: any, @Body() body: UpsertTemplateDto) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    const text = String(body.text || '').trim();
    if (!text) throw new BadRequestException('text is required');

    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
      : [];

    return this.prisma.commentTemplate.create({
      data: {
        tenantId,
        text,
        tags,
        subject: body.subject || null,
        gradeBand: body.gradeBand || null,
        topic: body.topic || null,
      },
    });
  }

  /** PATCH /comments/:id  (update) */
  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: UpsertTemplateDto) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    const exists = await this.prisma.commentTemplate.findFirst({ where: { id, tenantId } });
    if (!exists) throw new BadRequestException('Template not found');

    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
      : undefined;

    return this.prisma.commentTemplate.update({
      where: { id },
      data: {
        text: body.text !== undefined ? String(body.text || '').trim() : undefined,
        subject: body.subject === undefined ? undefined : body.subject || null,
        gradeBand: body.gradeBand === undefined ? undefined : body.gradeBand || null,
        topic: body.topic === undefined ? undefined : body.topic || null,
        tags,
      },
    });
  }

  /** DELETE /comments/:id */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    const exists = await this.prisma.commentTemplate.findFirst({ where: { id, tenantId } });
    if (!exists) throw new BadRequestException('Template not found');

    await this.prisma.commentTemplate.delete({ where: { id } });
    return { ok: true };
  }
}