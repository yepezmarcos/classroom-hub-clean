import { Controller, Get, Post, Body, Query, Req, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { randomUUID } from 'crypto';

function tenantIdFromReq(req: any): string {
  const h =
    (req?.headers?.['x-tenant-id'] as string) ??
    (req?.headers?.['x-tenant'] as string) ??
    (req?.query?.['tenantId'] as string) ??
    (req?.query?.['tenant'] as string);
  const v = (h || '').trim();
  return v || 'default';
}

@Controller('grades')
export class GradesController {
  constructor(private prisma: PrismaService) {}

  @Get('_debug')
  async debug() {
    const g = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS n FROM "Grade"`
    ).catch(() => [{ n: -1 }]);
    return { gradeCount: g?.[0]?.n ?? null };
  }

  @Get()
  async list(@Query('assignmentId') assignmentId?: string, @Query('studentId') studentId?: string) {
    try {
      const hasAssignment = !!(assignmentId && String(assignmentId).trim());
      const hasStudent = !!(studentId && String(studentId).trim());

      if (!hasAssignment && !hasStudent) {
        throw new BadRequestException('Provide assignmentId or studentId');
      }

      if (hasAssignment && hasStudent) {
        return await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT g.id, g."tenantId", g."assignmentId", g."studentId", g.score, g.feedback, g."createdAt",
                  s.first, s.last
           FROM "Grade" g
           JOIN "Student" s ON s.id = g."studentId"
           WHERE g."assignmentId" = $1 AND g."studentId" = $2
           ORDER BY s.last, s.first`,
          assignmentId, studentId,
        );
      }

      if (hasAssignment) {
        return await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT g.id, g."tenantId", g."assignmentId", g."studentId", g.score, g.feedback, g."createdAt",
                  s.first, s.last
           FROM "Grade" g
           JOIN "Student" s ON s.id = g."studentId"
           WHERE g."assignmentId" = $1
           ORDER BY s.last, s.first`,
          assignmentId,
        );
      }

      return await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT g.id, g."tenantId", g."assignmentId", g."studentId", g.score, g.feedback, g."createdAt",
                a.name AS assignment, s.first, s.last
         FROM "Grade" g
         JOIN "Assignment" a ON a.id = g."assignmentId"
         JOIN "Student" s ON s.id = g."studentId"
         WHERE g."studentId" = $1
         ORDER BY a.name, s.last, s.first`,
        studentId,
      );
    } catch (e: any) {
      console.error('GRADES_LIST_ERROR', e);
      throw new BadRequestException(e?.message || 'Failed to list grades');
    }
  }

  @Post()
  async upsert(@Body() body: any, @Req() req: any) {
    const assignmentId = String(body?.assignmentId || '').trim();
    const studentId = String(body?.studentId || '').trim();
    const score = Number(body?.score);
    const feedback = (body?.feedback ?? null) as string | null;

    if (!assignmentId || !studentId) throw new BadRequestException('assignmentId and studentId are required');
    if (!Number.isFinite(score)) throw new BadRequestException('score must be a number');

    try {
      // verify assignment & get tenantId + max
      const [a] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, "tenantId", max FROM "Assignment" WHERE id = $1 LIMIT 1`,
        assignmentId,
      );
      if (!a?.id) throw new BadRequestException('Assignment not found');

      // verify student exists
      const [s] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "Student" WHERE id = $1 LIMIT 1`,
        studentId,
      );
      if (!s?.id) throw new BadRequestException('Student not found');

      // use assignment tenant (most reliable); fall back to header if needed
      const tenantId = a.tenantId ?? tenantIdFromReq(req);

      const id = randomUUID();
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "Grade" (id, "tenantId", "assignmentId", "studentId", score, feedback)
         VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))
         ON CONFLICT ("assignmentId","studentId")
         DO UPDATE SET score = EXCLUDED.score,
                       feedback = COALESCE(NULLIF(EXCLUDED.feedback,''), "Grade".feedback)
         RETURNING id, "tenantId", "assignmentId", "studentId", score, feedback`,
        id, tenantId, assignmentId, studentId, score, feedback ?? null,
      );

      if (!rows?.[0]) throw new BadRequestException('Upsert failed');
      return rows[0];
    } catch (e: any) {
      console.error('GRADES_UPSERT_ERROR', e);
      throw new BadRequestException(e?.message || 'Failed to upsert grade');
    }
  }
}