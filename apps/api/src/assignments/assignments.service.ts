import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import crypto from 'node:crypto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  private async tableExists(qualified: string): Promise<boolean> {
    const [row] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      qualified,
    );
    return !!row?.exists;
  }

  private async columnExists(table: string, column: string): Promise<boolean> {
    const [row] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2
      ) AS exists
      `,
      table, column,
    );
    return !!row?.exists;
  }

  private async resolveTenantId(): Promise<string> {
    // Your Assignment table requires tenantId NOT NULL. We'll pick an existing tenant or create "default".
    const hasTenant = await this.tableExists('public."Tenant"');
    if (!hasTenant) return 'default';
    const [row] = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Tenant" ORDER BY id LIMIT 1`);
    if (row?.id) return row.id;

    // try to create a default tenant if Tenant table is empty
    try {
      const [created] = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "Tenant"(id,name) VALUES ($1,$2) RETURNING id`,
        'default', 'Default',
      );
      return created?.id || 'default';
    } catch {
      return 'default';
    }
  }

  /** List assignments for a classroom (with gradesCount if Grade table has assignmentId) */
  async listByClassroom(classroomId: string) {
    const hasGrade = await this.tableExists('public."Grade"');
    const hasAssignmentIdCol = hasGrade ? await this.columnExists('Grade','assignmentId') : false;

    if (hasGrade && hasAssignmentIdCol) {
      // Count grades per-assignment
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT a.id, a."classroomId", a."tenantId",
               a.name, a.category, a.max, a.term, a."createdAt",
               COALESCE(gc.cnt,0)::int AS "gradesCount"
        FROM "Assignment" a
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt
          FROM "Grade" g
          WHERE g."assignmentId" = a.id
        ) gc ON TRUE
        WHERE a."classroomId" = $1
        ORDER BY a."createdAt" DESC NULLS LAST, a.name
        LIMIT 1000
        `,
        classroomId,
      );
      // Add friendly aliases for frontend compatibility if needed
      return rows.map(r => ({ ...r, title: r.name, maxPoints: r.max }));
    }

    // Fallback without grades count
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT a.id, a."classroomId", a."tenantId",
             a.name, a.category, a.max, a.term, a."createdAt"
      FROM "Assignment" a
      WHERE a."classroomId" = $1
      ORDER BY a."createdAt" DESC NULLS LAST, a.name
      LIMIT 1000
      `,
      classroomId,
    );
    return rows.map(r => ({ ...r, title: r.name, maxPoints: r.max }));
  }

  /** Create assignment using your schema: { name, max, category?, term? } */
  async create(classroomId: string, body: { name?: string; max?: number; category?: string|null; term?: string|null; }) {
    const name = (body.name || '').trim();
    if (!name) throw new BadRequestException('name is required');

    const id = crypto.randomUUID();
    const tenantId = await this.resolveTenantId();
    const max = typeof body.max === 'number' ? body.max : 100;
    const category = body.category ?? null;
    const term = body.term ?? null;

    // Honor unique (classroomId, name)
    try {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO "Assignment"(id,"tenantId","classroomId",name,category,max,term,"createdAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        `,
        id, tenantId, classroomId, name, category, max, term,
      );
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('Assignment_classroomId_name_key')) {
        throw new BadRequestException('An assignment with this name already exists in this class');
      }
      throw e;
    }

    const [row] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id,"tenantId","classroomId",name,category,max,term,"createdAt" FROM "Assignment" WHERE id=$1`,
      id,
    );
    return { ...row, title: row.name, maxPoints: row.max };
  }

  async get(id: string) {
    const [row] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id,"tenantId","classroomId",name,category,max,term,"createdAt" FROM "Assignment" WHERE id=$1 LIMIT 1`,
      id,
    );
    if (!row) throw new NotFoundException('Assignment not found');
    return { ...row, title: row.name, maxPoints: row.max };
  }
}