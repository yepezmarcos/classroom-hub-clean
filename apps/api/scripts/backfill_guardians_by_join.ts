// apps/api/scripts/backfill_guardians_by_join.ts
import { PrismaClient } from "@prisma/client";

function need(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const SOURCE = need("SOURCE_DATABASE_URL");             // local Postgres
const DEST   = process.env.DEST_DATABASE_URL || need("DATABASE_URL"); // Neon

const prismaSrc = new PrismaClient({ datasources: { db: { url: SOURCE } } });
const prismaDst = new PrismaClient({ datasources: { db: { url: DEST } } });

type JoinRow = {
  s_id: string;
  s_email: string | null;
  s_first: string | null;
  s_last: string | null;
  g_email: string | null;
  g_name: string | null;
  g_phone: string | null;
  rel: string | null;
};

async function ensureGuardianInDest(email: string, name?: string | null, phone?: string | null) {
  const e = email.trim().toLowerCase();
  // try upsert (if email is unique), else fallback to find/create
  try {
    return await prismaDst.guardian.upsert({
      where: { email: e as any },
      update: { name: name ?? undefined, phone: phone ?? undefined },
      create: { email: e, name: name ?? null, phone: phone ?? null } as any,
    });
  } catch {
    const g = await prismaDst.guardian.findFirst({ where: { email: e } });
    if (g) return g;
    return prismaDst.guardian.create({
      data: { email: e, name: name ?? null, phone: phone ?? null } as any,
    });
  }
}

async function linkStudentGuardian(studentId: string, guardianId: string, relationship?: string | null) {
  const exists = await prismaDst.studentGuardian.findFirst({
    where: { studentId, guardianId } as any,
    select: { id: true },
  });
  if (exists) return false;

  try {
    await prismaDst.studentGuardian.create({
      data: { studentId, guardianId, relationship: relationship ?? null } as any,
    });
    return true;
  } catch {
    // dest schema may not have relationship column
    await (prismaDst as any).studentGuardian.create({
      data: { studentId, guardianId },
    });
    return true;
  }
}

async function recomputeGuardianCountsIfPresent() {
  try {
    const groups = await prismaDst.studentGuardian.groupBy({
      by: ["studentId"],
      _count: { _all: true },
    });
    for (const g of groups) {
      await prismaDst.student.update({
        where: { id: (g as any).studentId },
        data: { guardianCount: (g as any)._count._all },
      });
    }
  } catch {
    // guardianCount column not present — skip silently
  }
}

async function main() {
  // Pull (student, guardian, relationship) from SOURCE using joins
  let rows: JoinRow[] = [];
  try {
    rows = await prismaSrc.$queryRaw<JoinRow[]>`
      SELECT s.id AS s_id, s.email AS s_email, s.first AS s_first, s.last AS s_last,
             g.email AS g_email, g.name AS g_name, g.phone AS g_phone,
             sg."relationship" AS rel
      FROM "Student" s
      JOIN "StudentGuardian" sg ON sg."studentId" = s."id"
      JOIN "Guardian" g ON g."id" = sg."guardianId"
      ORDER BY s."createdAt" ASC
    `;
  } catch {
    // relationship column might not exist; fetch everything else
    rows = await prismaSrc.$queryRaw<JoinRow[]>`
      SELECT s.id AS s_id, s.email AS s_email, s.first AS s_first, s.last AS s_last,
             g.email AS g_email, g.name AS g_name, g.phone AS g_phone,
             NULL::text AS rel
      FROM "Student" s
      JOIN "StudentGuardian" sg ON sg."studentId" = s."id"
      JOIN "Guardian" g ON g."id" = sg."guardianId"
      ORDER BY s."createdAt" ASC
    `;
  }

  let matchedStudents = 0, guardiansEnsured = 0, linksCreated = 0, skipped = 0;

  for (const r of rows) {
    const gEmail = (r.g_email ?? "").trim().toLowerCase();
    if (!gEmail) { skipped++; continue; }

    // Find matching student in DEST (prefer email match, fallback to first+last)
    let dstStudent = null as null | { id: string };

    if (r.s_email && r.s_email.trim()) {
      dstStudent = await prismaDst.student.findFirst({
        where: { email: r.s_email.trim().toLowerCase() },
        select: { id: true },
      });
    }

    if (!dstStudent && (r.s_first || r.s_last)) {
      const first = (r.s_first ?? "").trim();
      const last  = (r.s_last ?? "").trim();
      dstStudent = await prismaDst.student.findFirst({
        where: {
          AND: [
            first ? { first: { equals: first } } : {},
            last  ? { last:  { equals: last  } } : {},
          ],
        } as any,
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!dstStudent) { skipped++; continue; }
    matchedStudents++;

    const g = await ensureGuardianInDest(gEmail, r.g_name, r.g_phone);
    if (g) guardiansEnsured++;

    const linked = await linkStudentGuardian(dstStudent.id, g.id, r.rel ?? null);
    if (linked) linksCreated++;
  }

  await recomputeGuardianCountsIfPresent();

  console.log(`Matched students in Neon: ${matchedStudents}`);
  console.log(`Guardians ensured in Neon: ${guardiansEnsured}`);
  console.log(`Student↔Guardian links created: ${linksCreated}`);
  console.log(`Skipped (no guardian email / no student match): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await prismaSrc.$disconnect();
    await prismaDst.$disconnect();
  });