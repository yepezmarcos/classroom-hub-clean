// apps/api/scripts/backfill_guardians.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function ensureGuardian(email: string, name?: string | null, phone?: string | null) {
  const safeEmail = email.trim().toLowerCase();
  if (!safeEmail) return null;

  // Try unique on email first; if schema lacks unique, fallback to findFirst
  try {
    return await prisma.guardian.upsert({
      where: { email: safeEmail as any }, // ok if @unique exists
      update: { name: name ?? undefined, phone: phone ?? undefined },
      create: { email: safeEmail, name: name ?? null, phone: phone ?? null } as any,
    });
  } catch {
    const existing = await prisma.guardian.findFirst({ where: { email: safeEmail } });
    if (existing) return existing;
    return prisma.guardian.create({ data: { email: safeEmail, name: name ?? null, phone: phone ?? null } as any });
  }
}

async function linkStudentGuardian(studentId: string, guardianId: string, relationship?: string | null) {
  // Skip if already linked
  const exists = await prisma.studentGuardian.findFirst({ where: { studentId, guardianId } as any });
  if (exists) return "exists";

  // Try with relationship (if column exists)
  try {
    await prisma.studentGuardian.create({
      data: { studentId, guardianId, relationship: relationship ?? null } as any,
    });
    return "linked";
  } catch {
    // Fallback schema variant without relationship column
    await (prisma as any).studentGuardian.create({
      data: { studentId, guardianId },
    });
    return "linked";
  }
}

async function recomputeGuardianCounts() {
  try {
    const groups = await prisma.studentGuardian.groupBy({
      by: ["studentId"],
      _count: { _all: true },
    });
    for (const g of groups) {
      await prisma.student.update({
        where: { id: g.studentId },
        data: { guardianCount: (g as any)._count._all },
      });
    }
  } catch {
    // If guardianCount column doesn't exist in your schema, just ignore
  }
}

async function main() {
  const students = await prisma.student.findMany({
    select: {
      id: true,
      guardianEmail: true,
      guardianName: true,
      guardianPhone: true,
      guardianRelationship: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let gCreatedOrFound = 0, links = 0, skipped = 0;

  for (const s of students) {
    const email = (s.guardianEmail ?? "").trim().toLowerCase();
    if (!email) { skipped++; continue; }

    const g = await ensureGuardian(email, s.guardianName, s.guardianPhone);
    if (!g) { skipped++; continue; }
    gCreatedOrFound++;

    const res = await linkStudentGuardian(s.id, g.id, s.guardianRelationship ?? null);
    if (res === "linked") links++;
  }

  await recomputeGuardianCounts();

  console.log(`Guardians ensured (found or created): ${gCreatedOrFound}`);
  console.log(`Student↔Guardian links created: ${links}`);
  console.log(`Students skipped (no email): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());