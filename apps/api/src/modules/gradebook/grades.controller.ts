import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type UpsertGradeDto = {
  assignmentId: string;
  studentId: string;
  value: number; // your numeric score
};

@Controller('grades')
export class GradesController {
  constructor(private prisma: PrismaService) {}

  private async gradeColumn(): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<{ col: string }[]>(
      `
      WITH cols AS (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='Grade'
      )
      SELECT CASE
        WHEN EXISTS (SELECT 1 FROM cols WHERE column_name='points') THEN 'points'
        WHEN EXISTS (SELECT 1 FROM cols WHERE column_name='score')  THEN 'score'
        WHEN EXISTS (SELECT 1 FROM cols WHERE column_name='value')  THEN 'value'
        ELSE ''
      END AS col;
      `
    );
    const col = rows?.[0]?.col || '';
    if (!col) throw new Error('No numeric grade column (points/score/value) found on "Grade".');
    return col;
  }

  private async tenantForAssignment(assignmentId: string): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<{ tenantId: string | null }[]>(
      `SELECT "tenantId" FROM "Assignment" WHERE id=$1 LIMIT 1`,
      assignmentId
    );
    if (rows?.[0]?.tenantId) return rows[0].tenantId;

    // fallback to default tenant
    const t = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `
      SELECT id FROM "Tenant" WHERE id='default' LIMIT 1
      UNION ALL
      SELECT id FROM "Tenant"
      WHERE id <> 'default'
      ORDER BY 1
      LIMIT 1
      `
    );
    return t?.[0]?.id || 'default';
  }

  @Get()
  async list(@Query('assignmentId') assignmentId?: string) {
    if (!assignmentId) return [];
    const col = await this.gradeColumn();

    // join with student so UI has names
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        g.id, g."assignmentId", g."studentId",
        g."${col}" AS value,
        s.first, s.last
      FROM "Grade" g
      JOIN "Student" s ON s.id = g."studentId"
      WHERE g."assignmentId" = $1
      ORDER BY s.last ASC, s.first ASC
      LIMIT 1000
      `,
      assignmentId
    );
    return rows;
  }

  @Put()
  async upsert(@Body() body: UpsertGradeDto) {
    const assignmentId = String(body.assignmentId || '').trim();
    const studentId = String(body.studentId || '').trim();
    const value = Number(body.value);

    if (!assignmentId || !studentId || Number.isNaN(value)) {
      throw new Error('assignmentId, studentId, and numeric value are required');
    }

    const col = await this.gradeColumn();
    const tenantId = await this.tenantForAssignment(assignmentId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "Grade" (id, "tenantId", "assignmentId", "studentId", "${col}")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
      ON CONFLICT ("assignmentId","studentId")
      DO UPDATE SET "${col}" = EXCLUDED."${col}"
      RETURNING id, "tenantId", "assignmentId", "studentId", "${col}" AS value;
      `,
      tenantId, assignmentId, studentId, value
    );
    return rows[0];
  }
}