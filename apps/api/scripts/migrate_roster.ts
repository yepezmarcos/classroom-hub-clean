import { PrismaClient } from '@prisma/client';

const SRC = process.env.SOURCE_DATABASE_URL;   // local PG
const DST = process.env.DEST_DATABASE_URL;     // Neon
if (!SRC || !DST) {
  console.error('Please set SOURCE_DATABASE_URL and DEST_DATABASE_URL.');
  process.exit(1);
}

const prismaSrc = new PrismaClient({ datasources: { db: { url: SRC } } });
const prismaDst = new PrismaClient({ datasources: { db: { url: DST } } });

// We’ll force everything into this tenant in Neon.
const DEFAULT_TENANT_ID = 'default-tenant';
const DEFAULT_TENANT_NAME = 'Default School';

async function ensureTenant() {
  await prismaDst.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {},
    create: { id: DEFAULT_TENANT_ID, name: DEFAULT_TENANT_NAME },
  });
  console.log(`Ensured tenant "${DEFAULT_TENANT_NAME}" (${DEFAULT_TENANT_ID}) in Neon`);
}

async function copyStudents() {
  // IMPORTANT: only select safe columns (skip tenantId if NULL in source)
  const rows = await prismaSrc.student.findMany({
    select: {
      id: true,
      first: true,
      last: true,
      grade: true,
      email: true,
      gender: true,
      // Some schemas have pronouns/string, some don’t—safe guard:
      // @ts-ignore
      pronouns: true,
      iep: true,
      ell: true,
      medical: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  console.log(`Students to copy: ${rows.length}`);

  let ok = 0, fail = 0;
  for (const s of rows) {
    try {
      await prismaDst.student.upsert({
        where: { id: s.id },
        update: {
          first: s.first,
          last: s.last,
          grade: s.grade,
          email: s.email,
          gender: s.gender as any,
          // @ts-ignore
          pronouns: (s as any).pronouns ?? null,
          iep: s.iep,
          ell: s.ell,
          medical: s.medical,
          tenantId: DEFAULT_TENANT_ID,
          updatedAt: s.updatedAt ?? new Date(),
        },
        create: {
          id: s.id,
          first: s.first,
          last: s.last,
          grade: s.grade,
          email: s.email,
          gender: s.gender as any,
          // @ts-ignore
          pronouns: (s as any).pronouns ?? null,
          iep: s.iep,
          ell: s.ell,
          medical: s.medical,
          tenantId: DEFAULT_TENANT_ID,
          createdAt: s.createdAt ?? new Date(),
          updatedAt: s.updatedAt ?? new Date(),
        },
      });
      ok++;
    } catch (e) {
      fail++;
      console.warn('Student upsert failed id=', s.id, e);
    }
  }
  console.log(`Students copied: ${ok}, failed: ${fail}`);
}

async function copyGuardians() {
  // Only safe columns; skip tenantId if it’s NULL in source
  const rows = await prismaSrc.guardian.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      // Some schemas include relationship; if not, this will be ignored below
      // @ts-ignore
      relationship: true,
    }
  });
  console.log(`Guardians to copy: ${rows.length}`);

  let ok = 0, fail = 0;
  for (const g of rows) {
    try {
      await prismaDst.guardian.upsert({
        where: { id: g.id },
        update: {
          name: g.name,
          email: g.email,
          phone: g.phone,
          // @ts-ignore
          relationship: (g as any).relationship ?? null,
          tenantId: DEFAULT_TENANT_ID,
        },
        create: {
          id: g.id,
          name: g.name,
          email: g.email,
          phone: g.phone,
          // @ts-ignore
          relationship: (g as any).relationship ?? null,
          tenantId: DEFAULT_TENANT_ID,
        },
      });
      ok++;
    } catch (e) {
      fail++;
      console.warn('Guardian upsert failed id=', g.id, e);
    }
  }
  console.log(`Guardians copied: ${ok}, failed: ${fail}`);
}

async function copyStudentGuardianLinks() {
  // Read from source; try to include relationship if it exists there
  let rows: Array<{ studentId: string; guardianId: string; relationship?: string | null }>;
  try {
    rows = await (prismaSrc as any).studentGuardian.findMany({
      select: { studentId: true, guardianId: true, relationship: true }
    });
  } catch {
    rows = await (prismaSrc as any).studentGuardian.findMany({
      select: { studentId: true, guardianId: true }
    });
  }
  console.log(`Links to copy: ${rows.length}`);

  let ok = 0, fail = 0;

  for (const l of rows) {
    const dataBase: any = { studentId: l.studentId, guardianId: l.guardianId };
    if (typeof (l as any).relationship !== 'undefined') {
      dataBase.relationship = (l as any).relationship;
    }

    // Prefer upsert on composite key if dest schema supports it
    try {
      await (prismaDst as any).studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: l.studentId, guardianId: l.guardianId } },
        update: {},
        create: dataBase,
      });
      ok++;
      continue;
    } catch {
      // Fall back if dest schema lacks the composite unique
    }

    try {
      await (prismaDst as any).studentGuardian.create({ data: dataBase });
      ok++;
    } catch (e2) {
      fail++;
      console.warn('Link insert failed', l, e2);
    }
  }

  console.log(`Links copied: ${ok}, failed: ${fail}`);
}

async function copyCommentTemplates() {
  // Skip cleanly if not present in source schema
  let templates: any[] = [];
  try {
    templates = await (prismaSrc as any).commentTemplate.findMany({
      select: {
        id: true,
        text: true,
        // optional fields vary by schema
        level: true,
        topic: true,
        tags: true,
        createdAt: true,
      }
    });
  } catch {
    console.log('No CommentTemplate in source; skipping.');
    return;
  }

  console.log(`CommentTemplates to copy: ${templates.length}`);
  let ok = 0, fail = 0;
  for (const c of templates) {
    try {
      await (prismaDst as any).commentTemplate.upsert({
        where: { id: c.id },
        update: {
          text: c.text,
          level: c.level ?? null,
          topic: c.topic ?? null,
          tags: c.tags ?? null,
          tenantId: DEFAULT_TENANT_ID,
        },
        create: {
          id: c.id,
          text: c.text,
          level: c.level ?? null,
          topic: c.topic ?? null,
          tags: c.tags ?? null,
          tenantId: DEFAULT_TENANT_ID,
          createdAt: c.createdAt ?? new Date(),
        },
      });
      ok++;
    } catch (e) {
      fail++; console.warn('CommentTemplate upsert failed id=', c.id, e);
    }
  }
  console.log(`CommentTemplates copied: ${ok}, failed: ${fail}`);

  // Optional skills table
  try {
    const skills = await (prismaSrc as any).commentTemplateSkill.findMany({
      select: { id: true, commentId: true, skillId: true }
    });
    console.log(`CommentTemplateSkill to copy: ${skills.length}`);
    let ok2 = 0, fail2 = 0;
    for (const s of skills) {
      try {
        await (prismaDst as any).commentTemplateSkill.create({
          data: { id: s.id ?? undefined, commentId: s.commentId, skillId: s.skillId },
        });
        ok2++;
      } catch {
        fail2++;
      }
    }
    console.log(`CommentTemplateSkill copied: ${ok2}, failed: ${fail2}`);
  } catch {
    console.log('CommentTemplateSkill missing; skipping.');
  }
}

async function main() {
  await prismaSrc.$connect();
  await prismaDst.$connect();
  await ensureTenant();
  await copyStudents();
  await copyGuardians();
  await copyStudentGuardianLinks();
  await copyCommentTemplates();
}
main().catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prismaSrc.$disconnect(); await prismaDst.$disconnect(); });