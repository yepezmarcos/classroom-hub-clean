import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('grades')
export class GradesController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async upsertGrade(
    @Body() body: any,
    @Headers('x-tenant-id') tenantHeader?: string,
  ) {
    const assignmentId = body?.assignmentId;
    const studentId = body?.studentId;
    const scoreNum = typeof body?.score === 'number' ? body.score : Number(body?.score);

    if (!assignmentId || !studentId || Number.isNaN(scoreNum)) {
      throw new BadRequestException('assignmentId, studentId, and numeric score are required');
    }

    // derive tenant from assignment if not provided
    let tenant = (tenantHeader || '').trim() || null;

    const rows = await this.prisma.$queryRawUnsafe<{ tenantId: string | null }[]>(
      `SELECT "tenantId" FROM "Assignment" WHERE id = $1 LIMIT 1`,
      assignmentId,
    );
    if (!rows?.length) throw new BadRequestException('Assignment not found');
    if (!tenant) tenant = rows[0].tenantId || 'default';

    // Ensure unique pair (assignmentId, studentId)
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO "Grade" (id, "tenantId", "assignmentId", "studentId", "score")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
      ON CONFLICT ("assignmentId","studentId")
      DO UPDATE SET "score" = EXCLUDED."score"
      `,
      tenant, assignmentId, studentId, scoreNum,
    );

    const [g] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "assignmentId", "studentId", "score"
       FROM "Grade"
       WHERE "assignmentId"=$1 AND "studentId"=$2
       LIMIT 1`,
      assignmentId, studentId,
    );
    return g || { ok: true };
  }
}