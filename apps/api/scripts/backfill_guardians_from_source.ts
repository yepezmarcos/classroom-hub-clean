// apps/api/scripts/backfill_guardians_from_source.ts
import { PrismaClient } from "@prisma/client";

function envRequired(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const SOURCE = envRequired("SOURCE_DATABASE_URL"); // local postgres
const DEST   = process.env.DEST_DATABASE_URL || envRequired("DATABASE_URL"); // Neon

// Two Prisma clients pointing at different DBs
const prismaSrc = new PrismaClient({ datasources: { db: { url: SOURCE } } });
const prismaDst = new PrismaClient({ datasources: { db: { url: DEST } } });

type SrcRow = {
  id: string;
  email: string | null;
  first: string | null;
  last: string | null;
  guardianEmail: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelationship: string | null;
};

async function ensureGuardianInDest(email: string, name?: string | null, phone?: string | null) {
  const e = email.trim().toLowerCase();
  // Try upsert on unique email; if schema doesn’t have @unique, fall back
  try {
    return await prismaDst.guardian.upsert({
      where: { email: e as any },
      update: { name: name ?? undefined, phone: phone ?? undefined },
      create: { email: e, name: name ?? null, phone: phone ?? null } as any,
    });
  } catch {
    const g = await prismaDst.guardian.findFirst({ where: { email: e } });
    if (g) return g;
    return prismaDst.guardian.create({ data: { email: e, name: name ?? null, phone: phone ?? null } as any });
  }
}

async function linkStudentGuardian(studentId: string, guardianId: string, relationship?: string | null) {
  const exists = await prismaDst.studentGuardian.findFirst({ where: { studentId, guardianId } as any });
  if (exists) return false;

  try {
    await prismaDst.studentGuardian.create({
      data: { studentId, guardianId, relationship: relationship ?? null } as any,
    });
    return true;
  } catch {
    // fallback schema (no relationship column)
    await (prismaDst as any).studentGuardian.create({ data: { studentId, guardianId } });
    return true;
  }
}

async function recomputeGuardianCounts() {
  try {
    const counts = await prismaDst.studentGuardian.groupBy({
      by: ["studentId"],
      _count: { _all: true },
    });
    for (const c of counts) {
      await prismaDst.student.update({
        where: { id: c.studentId },
        data: { guardianCount: (c as any)._count._all },
      });
    }
  } catch {
    // guardianCount not present in your schema — ignore
  }
}

async function main() {
  // Pull guardian info from the **source** DB using raw SQL so columns can differ from Prisma schema
  const srcRows = await prismaSrc.$queryRaw<SrcRow[]>`
    SELECT id, email, first, last,
           "guardianEmail", "guardianName", "guardianPhone", "guardianRelationship"
    FROM "Student"
    ORDER BY "createdAt" ASC
  `;

  let matchedStudents = 0, createdLinks = 0, skipped = 0, guardiansEnsured = 0;

  for (const s of srcRows) {
    const gEmail = (s.guardianEmail ?? "").trim().toLowerCase();
    if (!gEmail) { skipped++; continue; }

    // Find the corresponding student in Neon: prefer email match; else (first,last) fallback.
    let dstStudent = null;

    if (s.email && s.email.trim()) {
      dstStudent = await prismaDst.student.findFirst({
        where: { email: s.email.trim().toLowerCase() },
        select: { id: true },
      });
    }

    if (!dstStudent && (s.first || s.last)) {
      const first = (s.first ?? "").trim();
      const last  = (s.last ?? "").trim();
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

    // Ensure guardian in Neon
    const g = await ensureGuardianInDest(gEmail, s.guardianName, s.guardianPhone);
    if (g) guardiansEnsured++;

    // Link
    const linked = await linkStudentGuardian(dstStudent.id, g.id, s.guardianRelationship ?? null);
    if (linked) createdLinks++;
  }

  await recomputeGuardianCounts();

  console.log(`Matched students in Neon: ${matchedStudents}`);
  console.log(`Guardians ensured in Neon: ${guardiansEnsured}`);
  console.log(`Student↔Guardian links created: ${createdLinks}`);
  console.log(`Source students skipped (no match / no guardian email): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await prismaSrc.$disconnect();
    await prismaDst.$disconnect();
  });