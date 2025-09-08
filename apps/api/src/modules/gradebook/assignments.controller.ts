import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type CreateAssignmentDto = {
  classroomId: string;
  name: string;
  max?: number;
  category?: string | null;
  term?: string | null;
};

@Controller('assignments')
export class AssignmentsController {
  constructor(private prisma: PrismaService) {}

  private async getTenantId(): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `
      SELECT id FROM "Tenant" WHERE id='default' LIMIT 1
      UNION ALL
      SELECT id FROM "Tenant"
      WHERE id <> 'default'
      ORDER BY 1
      LIMIT 1
      `
    );
    return rows?.[0]?.id || 'default';
  }

  @Get()
  async list(@Query('classId') classId?: string) {
    if (!classId) return [];
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, name, "classroomId", "tenantId", max, category, term, "createdAt"
      FROM "Assignment"
      WHERE "classroomId" = $1
      ORDER BY "createdAt" DESC NULLS LAST, name ASC
      LIMIT 500
      `,
      classId
    );
    return rows;
  }

  @Post()
  async create(@Body() body: CreateAssignmentDto) {
    const classId = String(body.classroomId || '').trim();
    const name = String(body.name || '').trim();
    const max = typeof body.max === 'number' ? body.max : 10;
    const category = body.category ?? null;
    const term = body.term ?? null;

    if (!classId || !name) {
      throw new Error('classroomId and name are required');
    }

    const tenantId = await this.getTenantId();

    // Upsert by (classroomId, name) using ON CONFLICT
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "Assignment" (id, "tenantId", "classroomId", name, max, category, term)
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
      ON CONFLICT ("classroomId", name)
      DO UPDATE SET
        max = EXCLUDED.max,
        category = EXCLUDED.category,
        term = EXCLUDED.term
      RETURNING id, name, "tenantId", "classroomId", max, category, term, "createdAt";
      `,
      tenantId, classId, name, max, category, term
    );
    return rows[0];
  }
}