import { Controller, Get, Post, Body, Query, Headers } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('assignments')
export class AssignmentsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query('classroomId') classroomId?: string) {
    if (!classroomId) return [];
    return this.prisma.assignment.findMany({
      where: { classroomId },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, max: true, classroomId: true, tenantId: true },
    });
  }

  @Post()
  async create(
    @Body() body: { classroomId: string; name: string; max?: number },
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    if (!body?.classroomId || !body?.name) {
      throw new Error('classroomId and name are required');
    }
    const max = typeof body.max === 'number' ? body.max : 100;
    const t = (tenantId && tenantId.trim()) || 'default';
    return this.prisma.assignment.create({
      data: {
        name: body.name,
        max,
        classroomId: body.classroomId,
        tenantId: t,
      },
      select: { id: true, name: true, tenantId: true, classroomId: true, max: true },
    });
  }
}