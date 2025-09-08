import { Controller, Get, Post, Param, Body, Delete, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomUUID } from 'crypto';

@Controller('classes')
export class ClassesController {
  constructor(private prisma: PrismaService) {}

  // GET /classes  -> list all classes with student counts
  @Get()
  async list() {
    // make sure tables exist
    const [{ exists: hasClassroom }] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT to_regclass('public."Classroom"') IS NOT NULL AS exists`,
    );
    if (!hasClassroom) return [];

    // student count is optional if Enrollment exists
    const [{ exists: hasEnrollment }] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT to_regclass('public."Enrollment"') IS NOT NULL AS exists`,
    );

    if (!hasEnrollment) {
      return await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT c.id, c.name, c.code FROM "Classroom" c ORDER BY c.name ASC NULLS LAST`,
      );
    }

    return await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT c.id, c.name, c.code, COALESCE(sc.cnt,0)::int AS "studentCount"
      FROM "Classroom" c
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt FROM "Enrollment" e WHERE e."classroomId" = c.id
      ) sc ON TRUE
      ORDER BY c.name ASC NULLS LAST
      `,
    );
  }

  // POST /classes  body: { name: string, code?: string }
  @Post()
  async create(@Body() body: { name?: string; code?: string }) {
    const name = String(body?.name || '').trim();
    const code = (body?.code ? String(body.code) : '').trim() || null;
    if (!name) throw new BadRequestException('name is required');

    const id = randomUUID();
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "Classroom"(id, name, code) VALUES ($1, $2, $3)`,
        id, name, code,
      );
    } catch (e: any) {
      // unique code collisions, etc.
      throw new BadRequestException(String(e?.message || e));
    }
    const [row] = await this.prisma.$queryRawUnsafe<any[]>(`SELECT id, name, code FROM "Classroom" WHERE id=$1`, id);
    return row;
  }

  // GET /classes/:id/roster -> students + primary guardian summary
  @Get(':id/roster')
  async roster(@Param('id') id: string) {
    // verify class exists
    const [exists] = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Classroom" WHERE id=$1 LIMIT 1`, id,
    );
    if (!exists) throw new BadRequestException('Classroom not found');

    // check which guardian schema we have
    const [{ exists: hasGuardian }] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT to_regclass('public."Guardian"') IS NOT NULL AS exists`,
    );
    const [{ exists: hasStudentGuardian }] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT to_regclass('public."StudentGuardian"') IS NOT NULL AS exists`,
    );

    if (hasGuardian && hasStudentGuardian) {
      return this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          s.id, s.first, s.last, s.grade, s.email, s.gender, s.pronouns,
          s.iep, s.ell, s.medical,
          pg.name  AS "guardianName",
          pg.email AS "guardianEmail",
          pg.phone AS "guardianPhone",
          pgl.relationship AS "guardianRelationship"
        FROM "Enrollment" e
        JOIN "Student" s ON s.id = e."studentId"
        LEFT JOIN LATERAL (
          SELECT g.id, g.name, g.email, g.phone, sg.relationship
          FROM "StudentGuardian" sg
          JOIN "Guardian" g ON g.id = sg."guardianId"
          WHERE sg."studentId" = s.id
          ORDER BY g.name NULLS LAST, g.email NULLS LAST
          LIMIT 1
        ) pg ON TRUE
        LEFT JOIN LATERAL (
          SELECT relationship FROM "StudentGuardian" WHERE "studentId" = s.id
          ORDER BY relationship NULLS LAST LIMIT 1
        ) pgl ON TRUE
        WHERE e."classroomId" = $1
        ORDER BY s.last ASC NULLS LAST, s.first ASC NULLS LAST
        `,
        id,
      );
    } else {
      // legacy Parent/StudentParent fallback
      const [{ exists: hasParent }] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT to_regclass('public."Parent"') IS NOT NULL AS exists`,
      );
      const [{ exists: hasStudentParent }] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT to_regclass('public."StudentParent"') IS NOT NULL AS exists`,
      );
      if (!(hasParent && hasStudentParent)) {
        return this.prisma.$queryRawUnsafe<any[]>(
          `
          SELECT s.id, s.first, s.last, s.grade, s.email, s.gender, s.pronouns,
                 s.iep, s.ell, s.medical
          FROM "Enrollment" e
          JOIN "Student" s ON s.id = e."studentId"
          WHERE e."classroomId" = $1
          ORDER BY s.last ASC NULLS LAST, s.first ASC NULLS LAST
          `,
          id,
        );
      }
      return this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          s.id, s.first, s.last, s.grade, s.email, s.gender, s.pronouns,
          s.iep, s.ell, s.medical,
          pp.name  AS "guardianName",
          pp.email AS "guardianEmail",
          pp.phone AS "guardianPhone",
          ppl.relationship AS "guardianRelationship"
        FROM "Enrollment" e
        JOIN "Student" s ON s.id = e."studentId"
        LEFT JOIN LATERAL (
          SELECT p.id, p.name, p.email, p.phone
          FROM "StudentParent" sp
          JOIN "Parent" p ON p.id = sp."parentId"
          WHERE sp."studentId" = s.id
          ORDER BY p.name NULLS LAST, p.email NULLS LAST
          LIMIT 1
        ) pp ON TRUE
        LEFT JOIN LATERAL (
          SELECT relationship FROM "StudentParent" WHERE "studentId" = s.id
          ORDER BY relationship NULLS LAST LIMIT 1
        ) ppl ON TRUE
        WHERE e."classroomId" = $1
        ORDER BY s.last ASC NULLS LAST, s.first ASC NULLS LAST
        `,
        id,
      );
    }
  }

  // POST /classes/:id/enroll  body: { studentId: string }
  @Post(':id/enroll')
  async enroll(@Param('id') classroomId: string, @Body() body: { studentId?: string }) {
    const studentId = String(body?.studentId || '').trim();
    if (!studentId) throw new BadRequestException('studentId is required');

    // ensure both exist
    const [c] = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Classroom" WHERE id=$1 LIMIT 1`, classroomId);
    if (!c) throw new BadRequestException('Classroom not found');
    const [s] = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Student" WHERE id=$1 LIMIT 1`, studentId);
    if (!s) throw new BadRequestException('Student not found');

    // id for enrollment row (if your table has an id column)
    const enId = randomUUID();

    // create if not exists
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO "Enrollment"(id, "classroomId", "studentId")
      VALUES ($1, $2, $3)
      ON CONFLICT ("classroomId","studentId") DO NOTHING
      `,
      enId, classroomId, studentId,
    );

    return { ok: true };
  }

  // DELETE /classes/:id/enroll/:studentId
  @Delete(':id/enroll/:studentId')
  async unenroll(@Param('id') classroomId: string, @Param('studentId') studentId: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "Enrollment" WHERE "classroomId"=$1 AND "studentId"=$2`,
      classroomId, studentId,
    );
    return { ok: true };
  }
}