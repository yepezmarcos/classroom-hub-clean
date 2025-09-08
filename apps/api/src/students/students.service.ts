import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type GuardianIn = { name: string; email?: string|null; phone?: string|null; relationship?: string|null };
type GuardianOut = { id: string; name: string; email?: string|null; phone?: string|null; relationship?: string|null };

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  private async tableExists(qualified: string): Promise<boolean> {
    const [row] = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      qualified,
    );
    return !!row?.exists;
  }

  private coerceFlags<T extends { iep?: any; ell?: any; medical?: any }>(s: T) {
    return {
      ...s,
      iep: !!(s as any)?.iep,
      ell: !!(s as any)?.ell,
      medical: !!(s as any)?.medical,
    };
  }

  // ---------- LIST (with guardian summary + relationship) ----------
  async findMany(limit = 500) {
    const hasGuardian = await this.tableExists('public."Guardian"');
    const hasStudentGuardian = await this.tableExists('public."StudentGuardian"');

    let rows: any[] = [];

    if (hasGuardian && hasStudentGuardian) {
      // New schema: include sg.relationship
      rows = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          s.id, s.first, s.last, s.grade, s.email, s.gender, s.pronouns,
          s.iep, s.ell, s.medical, s."createdAt", s."updatedAt",
          fg.name  AS "guardianName",
          fg.email AS "guardianEmail",
          fg.phone AS "guardianPhone",
          fg.relationship AS "guardianRelationship",
          COALESCE(gc.cnt, 0)::int AS "guardianCount"
        FROM "Student" s
        LEFT JOIN LATERAL (
          SELECT g.name, g.email, g.phone, sg.relationship
          FROM "StudentGuardian" sg
          JOIN "Guardian" g ON g.id = sg."guardianId"
          WHERE sg."studentId" = s.id
          ORDER BY g.name NULLS LAST, g.email NULLS LAST
          LIMIT 1
        ) fg ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt
          FROM "StudentGuardian" sg
          WHERE sg."studentId" = s.id
        ) gc ON TRUE
        ORDER BY COALESCE(s."updatedAt", s."createdAt") DESC NULLS LAST
        LIMIT $1
        `,
        Number(limit) | 0,
      );
    } else {
      // Legacy fallback: Parent/StudentParent, include sp.relationship
      const hasParent = await this.tableExists('public."Parent"');
      const hasStudentParent = await this.tableExists('public."StudentParent"');

      if (hasParent && hasStudentParent) {
        rows = await this.prisma.$queryRawUnsafe<any[]>(
          `
          SELECT
            s.id, s.first, s.last, s.grade, s.email, s.gender, s.pronouns,
            s.iep, s.ell, s.medical, s."createdAt", s."updatedAt",
            fp.name  AS "guardianName",
            fp.email AS "guardianEmail",
            fp.phone AS "guardianPhone",
            fp.relationship AS "guardianRelationship",
            COALESCE(pc.cnt, 0)::int AS "guardianCount"
          FROM "Student" s
          LEFT JOIN LATERAL (
            SELECT p.name, p.email, p.phone, sp.relationship
            FROM "StudentParent" sp
            JOIN "Parent" p ON p.id = sp."parentId"
            WHERE sp."studentId" = s.id
            ORDER BY p.name NULLS LAST, p.email NULLS LAST
            LIMIT 1
          ) fp ON TRUE
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS cnt
            FROM "StudentParent" sp
            WHERE sp."studentId" = s.id
          ) pc ON TRUE
          ORDER BY COALESCE(s."updatedAt", s."createdAt") DESC NULLS LAST
          LIMIT $1
          `,
          Number(limit) | 0,
        );
      } else {
        // No guardian tables at all — just return students
        rows = await this.prisma.$queryRawUnsafe<any[]>(
          `
          SELECT s.id, s.first, s.last, s.grade, s.email, s.gender, s.pronouns,
                 s.iep, s.ell, s.medical, s."createdAt", s."updatedAt"
          FROM "Student" s
          ORDER BY COALESCE(s."updatedAt", s."createdAt") DESC NULLS LAST
          LIMIT $1
          `,
          Number(limit) | 0,
        );
      }
    }
    return rows.map((r) => this.coerceFlags(r));
  }

  // ---------- ONE (profile hydration) ----------
  async findOneHydrated(id: string) {
    const [studentRaw] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Student" WHERE id = $1 LIMIT 1`,
      id,
    );
    if (!studentRaw) throw new NotFoundException('Student not found');
    const student = this.coerceFlags(studentRaw);

    const hasGuardian = await this.tableExists('public."Guardian"');
    const hasStudentGuardian = await this.tableExists('public."StudentGuardian"');

    let guardians: GuardianOut[] = [];
    if (hasGuardian && hasStudentGuardian) {
      guardians = await this.prisma.$queryRawUnsafe<GuardianOut[]>(
        `
        SELECT g.id, g.name, g.email, g.phone, sg.relationship
        FROM "Guardian" g
        JOIN "StudentGuardian" sg ON sg."guardianId" = g.id
        WHERE sg."studentId" = $1
        ORDER BY g.name NULLS LAST
        `,
        id,
      );
    } else {
      const hasParent = await this.tableExists('public."Parent"');
      const hasStudentParent = await this.tableExists('public."StudentParent"');
      if (hasParent && hasStudentParent) {
        guardians = await this.prisma.$queryRawUnsafe<GuardianOut[]>(
          `
          SELECT p.id, p.name, p.email, p.phone, sp.relationship
          FROM "Parent" p
          JOIN "StudentParent" sp ON sp."parentId" = p.id
          WHERE sp."studentId" = $1
          ORDER BY p.name NULLS LAST
          `,
          id,
        );
      }
    }

    const enrollments = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT e.id, c.id AS "classroomId", c.name
      FROM "Enrollment" e
      JOIN "Classroom" c ON c.id = e."classroomId"
      WHERE e."studentId" = $1
      ORDER BY c.name NULLS LAST
      `,
      id,
    );
    const notes = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT n.id, n.body, n.tags, n."createdAt",
             u.name  AS "authorName",
             u.email AS "authorEmail"
      FROM "Note" n
      LEFT JOIN "User" u ON u.id = n."authorId"
      WHERE n."studentId" = $1
      ORDER BY n."createdAt" DESC
      LIMIT 500
      `,
      id,
    );

    const guardiansNorm = guardians.map((g) => ({
      id: g.id,
      name: g.name,
      email: g.email ?? null,
      phone: g.phone ?? null,
      relationship: g.relationship ?? null,
    }));

    return {
      ...student,
      parents: guardiansNorm,
      guardians: guardiansNorm,
      links: guardiansNorm.map((g) => ({
        relationship: g.relationship ?? null,
        guardian: { id: g.id, name: g.name, email: g.email ?? null, phone: g.phone ?? null },
      })),
      enrollments: enrollments.map((e) => ({
        classroom: { id: e.classroomId, name: e.name },
      })),
      notes: notes.map((n) => ({
        id: n.id,
        body: n.body,
        tags: n.tags,
        createdAt: n.createdAt,
        author: { name: n.authorName || null, email: n.authorEmail || null },
      })),
    };
  }

  // ---------- CREATE (with guardians) ----------
  async createOne(body: {
    first: string; last: string;
    grade?: string | null; email?: string | null;
    gender?: string | null; pronouns?: string | null;
    iep?: boolean; ell?: boolean; medical?: boolean;
    guardians?: GuardianIn[];
  }) {
    const student = await this.prisma.student.create({
      data: {
        first: body.first,
        last: body.last,
        grade: body.grade ?? null,
        email: body.email ?? null,
        gender: body.gender ?? null,
        pronouns: body.pronouns ?? null,
        iep: !!body.iep,
        ell: !!body.ell,
        medical: !!body.medical,
      },
    });

    const guardians = Array.isArray(body.guardians) ? body.guardians : [];

    if (guardians.length) {
      const hasGuardian = await this.tableExists('public."Guardian"');
      const hasStudentGuardian = await this.tableExists('public."StudentGuardian"');
      const hasParent = await this.tableExists('public."Parent"');
      const hasStudentParent = await this.tableExists('public."StudentParent"');

      if (hasGuardian && hasStudentGuardian) {
        for (const g of guardians) {
          let found: any = null;
          if (g.email && g.email.trim()) {
            const [row] = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT * FROM "Guardian" WHERE email = $1 LIMIT 1`,
              g.email.trim(),
            );
            found = row || null;
          }
          if (!found && g.name) {
            const [row] = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT * FROM "Guardian" WHERE name IS NOT DISTINCT FROM $1 AND phone IS NOT DISTINCT FROM $2 LIMIT 1`,
              g.name, g.phone ?? null,
            );
            found = row || null;
          }
          const guardian = found
            ? found
            : await this.prisma.guardian.create({
                data: {
                  name: g.name || '',
                  email: g.email ?? null,
                  phone: g.phone ?? null,
                },
              });
          // link
          try {
            await this.prisma.studentGuardian.create({
              data: {
                studentId: student.id,
                guardianId: guardian.id,
                relationship: g.relationship ?? null,
              },
            });
          } catch { /* ignore duplicates */ }
        }
      } else if (hasParent && hasStudentParent) {
        // old schema fallback
        for (const g of guardians) {
          let found: any = null;
          if (g.email && g.email.trim()) {
            const [row] = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT * FROM "Parent" WHERE email = $1 LIMIT 1`,
              g.email.trim(),
            );
            found = row || null;
          }
          if (!found && g.name) {
            const [row] = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT * FROM "Parent" WHERE name IS NOT DISTINCT FROM $1 AND phone IS NOT DISTINCT FROM $2 LIMIT 1`,
              g.name, g.phone ?? null,
            );
            found = row || null;
          }
          const parent = found
            ? found
            : await (this.prisma as any).parent.create({
                data: {
                  name: g.name || '',
                  email: g.email ?? null,
                  phone: g.phone ?? null,
                },
              });
          try {
            await (this.prisma as any).studentParent.create({
              data: {
                studentId: student.id,
                parentId: parent.id,
                relationship: g.relationship ?? null,
              },
            });
          } catch {}
        }
      }
    }

    return student;
  }
}