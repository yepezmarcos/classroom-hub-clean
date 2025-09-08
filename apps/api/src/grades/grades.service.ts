import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  private async tableExists(qualified: string): Promise<boolean> {
    const [row] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      qualified,
    );
    return !!row?.exists;
  }

  private async pickColumn(table: string, candidates: string[]): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name = ANY($2::text[])
      ORDER BY array_position($2::text[], column_name) ASC
      LIMIT 1
      `,
      table, candidates,
    );
    return rows[0]?.column_name ?? null;
  }

  private async getGradeShape() {
    const has = await this.tableExists('public."Grade"');
    if (!has) throw new BadRequestException('Grade table not found');

    const studentId = await this.pickColumn('Grade', ['studentId','student_id']);
    const assignmentId = await this.pickColumn('Grade', ['assignmentId','assignment_id']);
    if (!studentId || !assignmentId) {
      throw new BadRequestException('Grade table must have studentId and assignmentId (or snake_case)');
    }
    const points = (await this.pickColumn('Grade', ['points','score','value','mark'])) || 'points';
    const comment = (await this.pickColumn('Grade', ['comment','note','notes'])) || 'comment';
    const idCol = (await this.pickColumn('Grade', ['id'])) || 'id';

    return { idCol, studentId, assignmentId, points, comment };
  }

  /** List roster + grades for an assignment */
  async listForAssignment(assignmentId: string) {
    const shape = await this.getGradeShape();

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT s.id AS "studentId", s.first, s.last,
             g.${shape.idCol}   AS "gradeId",
             g.${shape.points}  AS "points",
             g.${shape.comment} AS "comment"
      FROM "Enrollment" e
      JOIN "Student" s ON s.id = e."studentId"
      LEFT JOIN "Grade" g
        ON g."${shape.studentId}" = s.id
       AND g."${shape.assignmentId}" = $1
      WHERE e."classroomId" = (SELECT "classroomId" FROM "Assignment" WHERE id = $1)
      ORDER BY s.last, s.first
      LIMIT 2000
      `,
      assignmentId,
    );
    return rows;
  }

  /** Upsert one grade */
  async upsertOne(assignmentId: string, body: { studentId?: string; points?: number|null; comment?: string|null }) {
    const sId = (body.studentId || '').trim();
    if (!sId) throw new BadRequestException('studentId is required');

    const shape = await this.getGradeShape();

    // Try an UPSERT
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "Grade" ("${shape.studentId}","${shape.assignmentId}","${shape.points}","${shape.comment}")
      VALUES ($1,$2,$3,$4)
      ON CONFLICT ("${shape.studentId}","${shape.assignmentId}")
      DO UPDATE SET "${shape.points}" = EXCLUDED."${shape.points}",
                    "${shape.comment}" = EXCLUDED."${shape.comment}"
      RETURNING "${shape.idCol}" AS "gradeId", "${shape.points}" AS points, "${shape.comment}" AS comment
      `,
      sId, assignmentId,
      (typeof body.points === 'number' ? body.points : null),
      body.comment ?? null,
    );
    return rows[0] || null;
  }

  async bulkUpsert(assignmentId: string, items: Array<{ studentId: string; points?: number|null; comment?: string|null }>) {
    let updated = 0;
    const out: any[] = [];
    for (const it of (items || [])) {
      if (!it?.studentId) continue;
      const r = await this.upsertOne(assignmentId, it);
      if (r) updated++;
      out.push(r);
    }
    return { updated, items: out };
  }
}