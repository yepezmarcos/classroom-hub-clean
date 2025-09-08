import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type LsCat = { id: string; label: string };

@Injectable()
export class LearningSkillsService {
  constructor(private prisma: PrismaService) {}

  /** Read categories directly from Settings (single row). */
  async getCurrentSchema() {
    const s = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const ls = (s?.lsCategories as any) || [];
    const version = this.hash(JSON.stringify(ls || []));
    return {
      categories: Array.isArray(ls) ? (ls as LsCat[]) : [],
      updatedAt: (s as any)?.updatedAt ?? null,
      version,
    };
  }

  /** Called after settings change. Optionally tries to copy LS to student profiles if a compatible model exists. */
  async syncFromSettings(opts?: { force?: boolean }) {
    const schema = await this.getCurrentSchema();

    // Try to push to a student-profile-like model (best effort; safe across schemas).
    let pushed = false;
    const p: any = this.prisma as any;
    const candidates = Object.keys(p)
      .filter((k) => !k.startsWith('$'))
      .filter((k) => /(student|pupil).*(profile|record|card)/i.test(k));

    for (const key of candidates) {
      const delegate = p[key];
      if (!delegate) continue;

      // Try updateMany → set lsCategories/json field. Wrap each attempt in try/catch.
      try {
        // Common JSON column names people use:
        for (const field of ['learningSkillsCategories', 'lsCategories', 'learningSkills']) {
          try {
            await delegate.updateMany({
              data: { [field]: schema.categories as any },
            });
            pushed = true;
            break;
          } catch {
            /* field doesn't exist, try next */
          }
        }
      } catch {
        /* ignore delegate errors */
      }
      if (pushed) break;
    }

    // Always return schema (UI uses it), and whether we pushed anything server-side.
    return { ok: true, ...schema, pushedToProfiles: pushed };
  }

  private hash(s: string) {
    let h = 0,
      i = 0,
      len = s.length;
    while (i < len) h = (h << 5) - h + s.charCodeAt(i++) | 0;
    return `v${(h >>> 0).toString(36)}`;
  }
}