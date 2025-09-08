import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomUUID } from 'crypto';

type StandardType = 'GENERAL' | 'SUBJECT';

function slugify(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class StandardsService {
  constructor(private prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Try to resolve a tenant we can attach the StandardSet to. */
  private async getOrCreateTenantId(): Promise<string | null> {
    try {
      const def = await this.prisma.tenant.findUnique({ where: { id: 'default' } as any });
      if (def?.id) return def.id;
    } catch {}

    try {
      const first = await this.prisma.tenant.findFirst();
      if (first?.id) return first.id;
    } catch {}

    try {
      const created = await (this.prisma as any).tenant.create({ data: { id: 'default', name: 'Default' } });
      return created?.id ?? null;
    } catch {
      try {
        const created = await (this.prisma as any).tenant.create({ data: { name: 'Default' } });
        return created?.id ?? null;
      } catch {}
    }
    return null;
  }

  /**
   * Read Settings.lsCategories (supports string[], or [{id,label}]) with a sane fallback.
   */
  private async getActiveLsCategoryLabels(): Promise<string[]> {
    const fallback = [
      'Responsibility',
      'Organization',
      'Independent Work',
      'Collaboration',
      'Initiative',
      'Self Regulation',
    ];
    try {
      const s = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
      if (!s || s.lsCategories == null) return fallback;

      const v: any = s.lsCategories;
      if (Array.isArray(v) && v.length > 0) {
        if (typeof v[0] === 'string') return v as string[];
        if (typeof v[0] === 'object' && v[0] && 'label' in v[0]) {
          return (v as Array<{ id?: string; label: string }>).map((x) => x.label).filter(Boolean);
        }
      }
    } catch {}
    return fallback;
  }

  // --------------------------------------------------------------------------
  // Public API used by your controller
  // --------------------------------------------------------------------------

  /** List sets (optionally filtered by type) */
  async listSets(type?: StandardType) {
    const where: any = {};
    if (type) where.type = type;

    return this.prisma.standardSet.findMany({
      where,
      orderBy: [{ jurisdiction: 'asc' }, { subject: 'asc' }, { gradeBand: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        type: true,
        jurisdiction: true,
        subject: true,
        gradeBand: true,
        name: true,
        framework: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { StandardSkill: true } },
      },
    });
  }

  /** List skills for a set, optional search + category filter */
  async listSkills(setId: string, q?: string, category?: string) {
    const where: any = { setId };
    if (q && q.trim()) {
      where.label = { contains: q.trim(), mode: 'insensitive' };
    }
    if (category && category.trim()) {
      const cat = category.trim();
      // allow filtering by `category` slug or by code match
      where.OR = [
        { category: { equals: cat, mode: 'insensitive' } },
        { category: { contains: cat, mode: 'insensitive' } },
        { code: { contains: cat, mode: 'insensitive' } },
      ];
    }

    return this.prisma.standardSkill.findMany({
      where,
      orderBy: { label: 'asc' },
      select: {
        id: true,
        setId: true,
        code: true,
        label: true,
        description: true,
        category: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** Distinct categories inside a set */
  async listCategories(setId: string) {
    // Prisma distinct works fine here
    const rows = await this.prisma.standardSkill.findMany({
      where: { setId },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    return rows
      .map((r) => r.category)
      .filter((x): x is string => !!x)
      .map((label) => ({ label, slug: slugify(label) }));
  }

  /**
   * Get the *active* Learning Skills set:
   * - Tries to find a GENERAL set for Ontario LS (gradeBand 'LS'), else a best-effort fallback.
   * - Always includes categories derived from Settings.lsCategories (normalized).
   */
  async getActiveLearningSkillsSet() {
    const categories = await this.getActiveLsCategoryLabels();

    // best guess for the "active" LS set
    let set =
      (await this.prisma.standardSet.findFirst({
        where: { type: 'GENERAL', jurisdiction: 'ontario', gradeBand: 'LS' },
      })) ||
      (await this.prisma.standardSet.findFirst({
        where: {
          type: 'GENERAL',
          name: { contains: 'Learning Skills', mode: 'insensitive' },
        },
        orderBy: { updatedAt: 'desc' },
      }));

    const catOut = categories.map((label) => ({ label, slug: slugify(label) }));

    if (!set) {
      return {
        set: null,
        categories: catOut,
        skills: [],
      };
    }

    const skills = await this.prisma.standardSkill.findMany({
      where: { setId: set.id },
      orderBy: { label: 'asc' },
      select: { id: true, code: true, label: true, category: true },
    });

    return {
      set: {
        id: set.id,
        tenantId: set.tenantId,
        type: set.type,
        jurisdiction: set.jurisdiction,
        subject: set.subject,
        gradeBand: set.gradeBand,
        name: set.name,
        framework: set.framework,
        createdAt: set.createdAt,
        updatedAt: set.updatedAt,
      },
      categories: catOut,
      skills,
    };
  }

  /**
   * Ensure a StandardSet for Ontario Learning Skills exists (and its StandardSkill rows).
   * - Upserts by (tenantId, type='GENERAL', jurisdiction='ontario', gradeBand='LS', name='Ontario Learning Skills')
   * - `updatedAt` is set explicitly (your schema requires it).
   */
  async seedLearningSkills() {
    const tenantId = (await this.getOrCreateTenantId()) ?? 'default';
    const categories = await this.getActiveLsCategoryLabels();

    const setName = 'Ontario Learning Skills';
    const jurisdiction = 'ontario';
    const gradeBand = 'LS';

    let set = await this.prisma.standardSet.findFirst({
      where: {
        tenantId,
        type: 'GENERAL',
        jurisdiction,
        gradeBand,
        name: setName,
      } as any,
    });

    if (!set) {
      set = await this.prisma.standardSet.create({
        data: {
          id: randomUUID(),
          tenantId,
          type: 'GENERAL',
          jurisdiction,
          subject: null,
          gradeBand,
          name: setName,
          framework: 'Ontario Learning Skills',
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.standardSet.update({
        where: { id: set.id },
        data: { updatedAt: new Date() },
      });
    }

    let created = 0;
    let skipped = 0;

    for (const label of categories) {
      const exists = await this.prisma.standardSkill.findFirst({
        where: { setId: set.id, label },
        select: { id: true },
      });
      if (exists?.id) {
        skipped++;
        continue;
      }

      const slug = slugify(label);
      await this.prisma.standardSkill.create({
        data: {
          id: randomUUID(),
          setId: set.id,
          code: slug.toUpperCase(), // e.g., INDEPENDENT-WORK
          label,                    // e.g., "Independent Work"
          description: null,
          category: slug,           // store a slug for category field
          updatedAt: new Date(),
        },
      });
      created++;
    }

    const skills = await this.prisma.standardSkill.findMany({
      where: { setId: set.id },
      orderBy: { label: 'asc' },
      select: { id: true, label: true, code: true, category: true },
    });

    return {
      ok: true,
      set: {
        id: set.id,
        tenantId: set.tenantId,
        type: set.type,
        jurisdiction: set.jurisdiction,
        subject: set.subject,
        gradeBand: set.gradeBand,
        name: set.name,
        framework: set.framework,
      },
      created,
      skipped,
      totalSkills: skills.length,
      skills,
    };
  }
}