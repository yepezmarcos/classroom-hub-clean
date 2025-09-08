import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CurriculumService {
  constructor(private prisma: PrismaService) {}

  /** Make sure we have some tenant to attach seeded curriculum to */
  private async ensureTenant() {
    // Prefer the first existing tenant if you already have one
    let t = await this.prisma.tenant.findFirst();
    if (t) return t;

    // Otherwise create a default tenant (non-auth demo)
    t = await this.prisma.tenant.create({
      data: {
        name: 'Default Tenant',
        plan: 'free',
      },
    });
    return t;
  }

  // Very light demo import. Expand with real scraping/AI later.
  async importFromLocation(body: {
    country?: string;
    stateProvince?: string;
    board?: string | null;
    grades?: string[];      // e.g. ['K-3']
    subjects?: string[];    // optional filter
  }) {
    const tenant = await this.ensureTenant();

    const country = body.country ?? 'Canada';
    const stateProvince = body.stateProvince ?? 'ON';
    const grades = (body.grades && body.grades.length ? body.grades : ['K-8']);
    const jurisdiction =
      stateProvince === 'ON' ? 'ontario' : (stateProvince || 'generic').toLowerCase();

    // Use a deterministic id so re-running is idempotent per tenant & region
    const setId = `demo-ela-${tenant.id}-${stateProvince.toLowerCase()}`;

    const set = await this.prisma.standardSet.upsert({
      where: { id: setId },
      update: {
        tenantId: tenant.id,
        jurisdiction,
        gradeBand: grades[0] || 'K-8',
        framework: `${country} ${stateProvince} demo import`,
      },
      create: {
        id: setId,
        tenantId: tenant.id,
        type: 'SUBJECT',
        jurisdiction,
        subject: 'Language',
        gradeBand: grades[0] || 'K-8',
        name: 'English Language Arts',
        framework: `${country} ${stateProvince} demo import`,
      },
    });

    // Tiny skill sample (idempotent-ish import)
    const skills = [
      { code: 'R1', label: 'Reading comprehension',   description: 'Understands grade-level texts', category: 'Reading' },
      { code: 'W1', label: 'Writing process',         description: 'Plans, drafts, revises writing', category: 'Writing' },
      { code: 'S1', label: 'Speaking & Listening',    description: 'Participates and communicates',  category: 'Oral' },
    ];

    for (const s of skills) {
      await this.prisma.standardSkill.upsert({
        where: { id: `${set.id}-${s.code}` },
        update: {
          description: s.description || undefined,
          category: s.category || undefined,
        },
        create: {
          id: `${set.id}-${s.code}`,
          setId: set.id,
          code: s.code,
          label: s.label,
          description: s.description || null,
          category: s.category || null,
        },
      });
    }

    return {
      message: 'Curriculum seeded (demo)',
      set: { id: set.id, subject: set.subject, gradeBand: set.gradeBand, name: set.name },
      skills: skills.map(s => ({ code: s.code, label: s.label })),
      subjectsAdded: ['Language'],
    };
  }
}