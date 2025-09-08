// apps/api/src/modules/internal/internal.controller.ts
import { Controller, Get, Req, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function assertInternal(req: any): string {
  const key = (req.headers['x-internal-key'] || '') as string;
  const want = process.env.INTERNAL_API_KEY || 'dev-local-key';
  if (key !== want) throw new ForbiddenException('Forbidden');
  const tenantId = (req.headers['x-tenant-id'] || '') as string;
  if (!tenantId) throw new ForbiddenException('Missing x-tenant-id');
  return tenantId;
}

@Controller('internal')
export class InternalController {
  constructor(private prisma: PrismaService) {}

  @Get('settings')
  async getSettings(@Req() req: any) {
    const tenantId = assertInternal(req);
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    // Always return an object so the UI can render safely
    return t?.settings ?? {};
  }

  @Get('comments')
  async listComments(@Req() req: any) {
    const tenantId = assertInternal(req);
    return this.prisma.commentTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        // keep it light; extend if your UI expects relations
        skills: { include: { skill: true } },
      },
    });
  }
}