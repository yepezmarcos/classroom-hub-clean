// apps/api/src/lib/comments.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ALLOWED_SKILLS = new Set([
  'collaboration',
  'organization',
  'initiative',
  'responsibility',
  'self-regulation',
  'independent-work',
]);

export const ALLOWED_LEVELS = new Set(['E', 'G', 'S', 'NS', 'NextSteps', 'END']);

/**
 * Try normalized join first (CommentTemplateSkill with skill/level columns).
 * If that table/columns don't exist, fall back to tags[] parsing.
 */
export async function getCommentSuggestions(skill: string, level?: string) {
  if (!ALLOWED_SKILLS.has(skill)) {
    throw new Error(
      `Invalid skill "${skill}". Valid: ${Array.from(ALLOWED_SKILLS).join(', ')}`
    );
  }
  if (level && !ALLOWED_LEVELS.has(level)) {
    throw new Error(
      `Invalid level "${level}". Valid: ${Array.from(ALLOWED_LEVELS).join(', ')}`
    );
  }

  // Prefer normalized table if present
  try {
    const rows = await prisma.$queryRaw<
      { id: string; text: string }[]
    >`
      SELECT c.id, c.text
      FROM "CommentTemplate" c
      JOIN "CommentTemplateSkill" cts
        ON cts."commentTemplateId" = c.id
      WHERE cts.skill = ${skill}
        AND (${level ?? null}::text IS NULL OR cts.level = ${level})
      ORDER BY c.id
    `;
    // If we got rows, return them
    if (rows.length > 0) return rows;
  } catch {
    // Fall through to tags fallback
  }

  // Fallback to tags[] if join table not available for this skill/level
  const likeTag = `ls:${toOntarioTag(skill)}`;
  const levelTag = level ? `level:${level}` : null;

  const rows = await prisma.$queryRaw<{ id: string; text: string }[]>`
    SELECT c.id, c.text
    FROM "CommentTemplate" c
    WHERE ${likeTag} = ANY(c.tags)
      AND (${levelTag ?? null}::text IS NULL OR ${levelTag} = ANY(c.tags))
    ORDER BY c.id
  `;

  return rows;
}

/**
 * Summary counts by skill/level.
 * Uses the normalized table if available; otherwise builds from tags[].
 */
export async function getSkillsSummary() {
  try {
    const rows = await prisma.$queryRaw<
      { skill: string; level: string | null; count: number }[]
    >`
      SELECT cts.skill,
             COALESCE(cts.level, '(none)') AS level,
             COUNT(*)::int AS count
      FROM "CommentTemplateSkill" cts
      GROUP BY 1,2
      ORDER BY 1,2
    `;
    if (rows.length > 0) return shapeSummary(rows);
  } catch {
    // ignore and fall back
  }

  // Fallback summary from tags[]
  const rows = await prisma.$queryRaw<
    { skill: string; level: string | null; count: number }[]
  >`
    WITH tagged AS (
      SELECT
        CASE
          WHEN 'ls:Collaboration'     = ANY(c.tags) THEN 'collaboration'
          WHEN 'ls:Organization'      = ANY(c.tags) THEN 'organization'
          WHEN 'ls:Initiative'        = ANY(c.tags) THEN 'initiative'
          WHEN 'ls:Responsibility'    = ANY(c.tags) THEN 'responsibility'
          WHEN 'ls:Self Regulation'   = ANY(c.tags) THEN 'self-regulation'
          WHEN 'ls:Independent Work'  = ANY(c.tags) THEN 'independent-work'
          ELSE NULL
        END AS skill,
        CASE
          WHEN 'level:E'         = ANY(c.tags) THEN 'E'
          WHEN 'level:G'         = ANY(c.tags) THEN 'G'
          WHEN 'level:S'         = ANY(c.tags) THEN 'S'
          WHEN 'level:NS'        = ANY(c.tags) THEN 'NS'
          WHEN 'level:NextSteps' = ANY(c.tags) THEN 'NextSteps'
          WHEN 'level:END'       = ANY(c.tags) THEN 'END'
          ELSE NULL
        END AS level
      FROM "CommentTemplate" c
    )
    SELECT skill, COALESCE(level, '(none)') AS level, COUNT(*)::int AS count
    FROM tagged
    WHERE skill IS NOT NULL
    GROUP BY 1,2
    ORDER BY 1,2
  `;
  return shapeSummary(rows);
}

function shapeSummary(
  rows: { skill: string; level: string | null; count: number }[]
) {
  const summary: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const l = r.level ?? '(none)';
    summary[r.skill] ??= {};
    summary[r.skill][l] = (summary[r.skill][l] ?? 0) + r.count;
  }
  return summary;
}

function toOntarioTag(skill: string) {
  switch (skill) {
    case 'collaboration':
      return 'Collaboration';
    case 'organization':
      return 'Organization';
    case 'initiative':
      return 'Initiative';
    case 'responsibility':
      return 'Responsibility';
    case 'self-regulation':
      return 'Self Regulation';
    case 'independent-work':
      return 'Independent Work';
    default:
      return skill;
  }
}