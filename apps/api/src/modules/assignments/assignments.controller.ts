import { Body, Controller, Get, Headers, Post, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

function headerTenant(h: Record<string, any>): string {
  const raw =
    (h?.['x-tenant-id'] ??
     h?.['X-Tenant-Id'] ??
     h?.['x-tenantid'] ??
     h?.['X-TenantId'] ??
     '').toString().trim();
  return raw || 'default';
}

@Controller('assignments')
export class AssignmentsController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async create(@Body() body: any, @Headers() headers: any) {
    const tenantId = headerTenant(headers);
    const classroomId = String(body?.classroomId || '').trim();
    const name = String(body?.name || '').trim();
    const max = Number(body?.max ?? 100);
    const category = body?.category ? String(body.category) : null;
    const term = body?.term ? String(body.term) : null;

    if (!classroomId || !name) {
      throw new BadRequestException('classroomId and name are required');
    }
    if (!Number.isFinite(max) || max <= 0) {
      throw new BadRequestException('max must be a positive number');
    }

    // Ensure classroom exists
    const classroom = await this.prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      throw new BadRequestException('classroom not found');
    }

    try {
      const created = await this.prisma.assignment.create({
        data: { tenantId, classroomId, name, max, category, term },
      });
      return created;
    } catch (e: any) {
      // Handle unique violation ("classroomId","name")
      if (e?.code === 'P2002') {
        const existing = await this.prisma.assignment.findFirst({ where: { classroomId, name } });
        if (existing) return existing;
      }
      // Surface message for common not-null/constraint errors
      if (e?.meta?.cause) throw new BadRequestException(e.meta.cause);
      throw e;
    }
  }

  @Get()
  async list(@Query('classroomId') classroomId?: string) {
    const where: any = classroomId ? { classroomId } : {};
    return this.prisma.assignment.findMany({ where, orderBy: { name: 'asc' } });
  }
}