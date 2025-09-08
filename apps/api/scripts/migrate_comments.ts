// apps/api/scripts/migrate_comments.ts
import { PrismaClient as PrismaSrc } from '@prisma/client'; // We'll override DATABASE_URL at runtime for src via env
import { PrismaClient as PrismaDst } from '@prisma/client';

const prismaSrc = new PrismaSrc({ datasources: { db: { url: process.env.SOURCE_DATABASE_URL! } } } as any);
const prismaDst = new PrismaDst({ datasources: { db: { url: process.env.DEST_DATABASE_URL! } } } as any);

const TENANT_SLUG = 'default-tenant';

async function ensureTenant() {
  const t = await (prismaDst as any).tenant.upsert({
    where: { id: TENANT_SLUG },
    update: {},
    create: { id: TENANT_SLUG, name: 'Default School' },
  });
  return t.id as string;
}

async function copyCommentTemplates(tenantId: string) {
  let templates: any[] = [];
  try {
    templates = await (prismaSrc as any).commentTemplate.findMany();
  } catch {
    console.log('No CommentTemplate in source; will fall back to JSON seeding if provided.');
    return false;
  }
  if (!templates.length) {
    console.log('CommentTemplate exists but is empty; will fall back to JSON seeding if provided.');
    return false;
  }

  // Only columns your Neon model supports (no `level`):
  const allow = new Set(['id', 'tenantId', 'text', 'tags', 'topic', 'subject' /*, 'createdAt' */]);

  let ok = 0, fail = 0;
  for (const c of templates) {
    // Build a safe payload by whitelisting keys and dropping `level`
    const data: any = {};
    // prefer tags as array if present; otherwise empty array
    const candidate = {
      id: c.id,
      tenantId,
      text: c.text,
      tags: Array.isArray(c.tags) ? c.tags : [],
      topic: c.topic ?? null,
      subject: c.subject ?? null,
      // DO NOT include: level
    };
    for (const k of Object.keys(candidate)) {
      if (candidate[k] !== undefined && allow.has(k)) data[k] = candidate[k];
    }

    try {
      if (c.id) {
        // If the dest model has a unique id (typical), upsert on id
        await (prismaDst as any).commentTemplate.upsert({
          where: { id: c.id },
          update: {
            // only update allowed keys (except id)
            text: data.text,
            tags: data.tags,
            topic: data.topic,
            subject: data.subject,
            tenantId: data.tenantId,
          },
          create: data,
        });
      } else {
        // No id in source? Just create.
        await (prismaDst as any).commentTemplate.create({ data });
      }
      ok++;
    } catch (e) {
      fail++;
      console.warn('Template copy failed', { id: c.id, text: String(c.text).slice(0, 20) }, e);
      // Fallback: try a minimal create (helps if some optional cols still differ)
      try {
        await (prismaDst as any).commentTemplate.create({
          data: {
            tenantId,
            text: c.text,
            tags: Array.isArray(c.tags) ? c.tags : [],
            topic: c.topic ?? null,
            subject: c.subject ?? null,
          }
        });
        ok++;
      } catch (e2) {
        console.warn('Fallback create failed', { id: c.id }, e2);
      }
    }
  }

  console.log(`Templates copied: ${ok}, failed: ${fail}`);
  return ok > 0;
}

async function copyCommentTemplateSkills() {
  try {
    const skills = await (prismaSrc as any).commentTemplateSkill.findMany();
    if (!skills.length) { console.log('No CommentTemplateSkill records in source.'); return; }

    let ok = 0, fail = 0;
    for (const s of skills) {
      try {
        await (prismaDst as any).commentTemplateSkill.upsert({
          where: { commentId_skillId: { commentId: s.commentId, skillId: s.skillId } },
          update: {},
          create: { commentId: s.commentId, skillId: s.skillId },
        });
        ok++;
      } catch (e) {
        fail++;
        console.warn('Skill link copy failed', s, e);
      }
    }
    console.log(`Skill links copied: ${ok}, failed: ${fail}`);
  } catch {
    console.log('No CommentTemplateSkill table in source.');
  }
}

async function main() {
  await ensureTenant();
  const copied = await copyCommentTemplates(TENANT_SLUG);
  if (copied) {
    await copyCommentTemplateSkills();
  } else {
    console.log('Nothing copied from source. If you want, add prisma/comments_ontario.json and run npm run seed:comments');
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });