import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OpenAIService } from '../ai/openai.service';

type LsCat = { id: string; label: string };
type BoardHit = { name: string; url?: string | null; score?: number };

const COUNTRIES = ['Canada', 'United States', 'United Kingdom', 'Australia'] as const;

const CANADA_PROVINCES = [
  'Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador',
  'Nova Scotia','Ontario','Prince Edward Island','Quebec','Saskatchewan',
  'Yukon','Northwest Territories','Nunavut'
];

const USA_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'
];

const UK_AREAS = ['England','Scotland','Wales','Northern Ireland'];

const AU_STATES = [
  'New South Wales','Victoria','Queensland','South Australia','Western Australia','Tasmania','Australian Capital Territory','Northern Territory'
];

/** Normalize “USA”/“US” to “United States”, etc. */
function normalizeCountry(c?: string) {
  const s = (c || '').trim().toLowerCase();
  if (!s) return '';
  if (['us', 'usa', 'u.s.', 'u.s.a.'].includes(s)) return 'United States';
  if (['uk', 'u.k.', 'great britain', 'britain'].includes(s)) return 'United Kingdom';
  if (['ca', 'can'].includes(s)) return 'Canada';
  if (['au', 'aus'].includes(s)) return 'Australia';
  return c || '';
}

/** Region list for a given country */
function regionsFor(country?: string) {
  const c = normalizeCountry(country);
  if (c === 'Canada') return CANADA_PROVINCES;
  if (c === 'United States') return USA_STATES;
  if (c === 'United Kingdom') return UK_AREAS;
  if (c === 'Australia') return AU_STATES;
  return [];
}

/** Jurisdiction id suggestion (used for tagging/comments) */
function suggestJurisdiction(country?: string, region?: string) {
  const c = normalizeCountry(country).toLowerCase();
  const r = (region || '').toLowerCase();
  if (c === 'canada' && r.startsWith('ont')) return 'ontario';
  if (c === 'canada') return 'canada';
  if (c === 'united states') return 'usa';
  if (c === 'united kingdom') return 'uk';
  if (c === 'australia') return 'australia';
  return c || null;
}

/** slug → id */
function slug(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** De-dupe + trim array of strings */
function uniqStrings(a: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of a || []) {
    const v = String(x || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/** Reasonable default LS categories by country/region (fallback for AI) */
function defaultLs(country?: string, region?: string): LsCat[] {
  const c = normalizeCountry(country).toLowerCase();
  const r = (region || '').toLowerCase();

  // Ontario official LS
  if (c === 'canada' && r.startsWith('ont')) {
    return [
      { id:'responsibility', label:'Responsibility' },
      { id:'organization', label:'Organization' },
      { id:'independent-work', label:'Independent Work' },
      { id:'collaboration', label:'Collaboration' },
      { id:'initiative', label:'Initiative' },
      { id:'self-regulation', label:'Self-Regulation' },
    ];
  }

  // UK
  if (c === 'united kingdom') {
    return [
      { id:'effort', label:'Effort' },
      { id:'behaviour', label:'Behaviour' },
      { id:'organisation', label:'Organisation' },
      { id:'independence', label:'Independence' },
      { id:'collaboration', label:'Collaboration' },
      { id:'homework', label:'Homework' },
    ];
  }

  // Australia
  if (c === 'australia') {
    return [
      { id:'personal-social', label:'Personal & Social Capability' },
      { id:'self-management', label:'Self-Management' },
      { id:'collaboration', label:'Collaboration' },
      { id:'initiative', label:'Initiative' },
      { id:'organisation', label:'Organisation' },
    ];
  }

  // USA / default
  return [
    { id:'participation', label:'Participation' },
    { id:'collaboration', label:'Collaboration' },
    { id:'work-habits', label:'Work Habits' },
    { id:'organization', label:'Organization' },
    { id:'initiative', label:'Initiative' },
    { id:'self-management', label:'Self-Management' },
  ];
}

/** Default subjects / grade bands by country (fallback for AI) */
function defaultsByCountry(country?: string, region?: string) {
  const c = normalizeCountry(country).toLowerCase();

  if (c === 'united kingdom') {
    return {
      subjects: ['English','Mathematics','Science','History','Geography','PE','Art & Design','Design & Technology','Computing','Music','Modern Foreign Languages'],
      gradeBands: ['KS1','KS2','KS3','KS4','KS5'],
    };
  }
  if (c === 'australia') {
    return {
      subjects: ['English','Mathematics','Science','Humanities and Social Sciences','Health & PE','The Arts','Technologies','Languages'],
      gradeBands: ['F–2','3–6','7–10','11–12'],
    };
  }
  if (c === 'canada') {
    return {
      subjects: ['Language','Mathematics','Science','Social Studies','Health & PE','The Arts'],
      gradeBands: ['K–3','4–6','7–8','9–12'],
    };
  }
  // USA / default
  return {
    subjects: ['English Language Arts','Mathematics','Science','Social Studies','Physical Education','Arts','Technology'],
    gradeBands: ['K–2','3–5','6–8','9–12'],
  };
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private ai: OpenAIService) {}

  private defaults() {
    return {
      id: 'singleton',
      jurisdiction: null as string | null,
      board: null as string | null,
      terms: 3,
      subjects: [] as string[],
      gradeBands: [] as string[],
      lsCategories: [] as any,
    };
  }

  /** Ensure the singleton row exists and return it. */
  private async ensureSingleton() {
    try {
      const row = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
      if (row) return row;
    } catch {}
    const d = this.defaults();
    return this.prisma.settings.create({
      data: {
        id: d.id,
        jurisdiction: d.jurisdiction,
        board: d.board,
        terms: d.terms,
        subjects: d.subjects as any,
        gradeBands: d.gradeBands as any,
        lsCategories: d.lsCategories as any,
      },
    });
  }

  async get() {
    // Always return a persisted DB row
    return this.ensureSingleton();
  }

  /**
   * Sync current Settings.lsCategories into the most recent GENERAL StandardSet,
   * replacing its skills so the Student Profile (which reads categories from standards)
   * reflects the new set immediately.
   *
   * If no standard set is present, this is a no-op.
   */
  private async syncLearningSkillsToExistingSet(ls: LsCat[]) {
    try {
      const set = await this.prisma.standardSet.findFirst({
        where: { type: 'GENERAL' as any },
        orderBy: [{ updatedAt: 'desc' as any }, { createdAt: 'desc' as any }],
      } as any);

      if (!set?.id) return;

      const categories = (ls || [])
        .map(c => {
          const label = String(c?.label || '').trim();
          const id = slug(String(c?.id || label));
          return label ? { id, label } : null;
        })
        .filter(Boolean) as LsCat[];

      await this.prisma.$transaction(async (tx) => {
        await (tx as any).standardSkill.deleteMany({ where: { setId: set.id } });

        if (categories.length) {
          await (tx as any).standardSkill.createMany({
            data: categories.map(c => ({
              setId: set.id,
              code: `LS-${slug(c.label)}`.toUpperCase().slice(0, 24),
              label: c.label,
              category: c.label,
              description: null,
            })),
          });
        }
      });
    } catch {
      // swallow to avoid breaking settings save
    }
  }

  async upsertSettings(payload: any) {
    const current = await this.get();

    const normLs: LsCat[] = Array.isArray(payload?.lsCategories)
      ? (payload.lsCategories as any[]).map((x: any) => {
          const label = String(x?.label ?? x?.name ?? '').trim();
          const id = slug(String(x?.id ?? label));
          return label ? { id, label } : null;
        }).filter(Boolean) as LsCat[]
      : ((current as any).lsCategories ?? []);

    const next = {
      ...current,
      ...payload,
      jurisdiction: payload?.jurisdiction ?? current.jurisdiction ?? null,
      board: payload?.board ?? current.board ?? null,
      terms: typeof payload?.terms === 'number' ? payload.terms : (current.terms ?? 3),
      subjects: Array.isArray(payload?.subjects) ? uniqStrings(payload.subjects) : (current.subjects ?? []),
      gradeBands: Array.isArray(payload?.gradeBands) ? uniqStrings(payload.gradeBands) : (current.gradeBands ?? []),
      lsCategories: normLs,
    };

    const saved = await this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        jurisdiction: next.jurisdiction,
        board: next.board,
        terms: next.terms,
        subjects: next.subjects as any,
        gradeBands: next.gradeBands as any,
        lsCategories: next.lsCategories as any,
      },
      create: {
        id: 'singleton',
        jurisdiction: next.jurisdiction,
        board: next.board,
        terms: next.terms,
        subjects: next.subjects as any,
        gradeBands: next.gradeBands as any,
        lsCategories: next.lsCategories as any,
      },
    });

    await this.syncLearningSkillsToExistingSet(saved.lsCategories as any);
    return saved;
  }

  /** Options for the Settings UI */
  async options({
    country = 'Canada',
    stateProvince = '',
    city = '',
    q = '',
  }: { country?: string; stateProvince?: string; city?: string; q?: string; }) {
    const normCountry = normalizeCountry(country);
    const stateProvinces = regionsFor(normCountry);
    const suggestedJurisdiction = suggestJurisdiction(normCountry, stateProvince);
    const suggestedLsCategories = defaultLs(normCountry, stateProvince);

    return {
      countries: COUNTRIES,
      stateProvinces,
      boards: [],
      suggestedJurisdiction,
      suggestedLsCategories,
    };
  }

  /** AI board finder */
  async findBoardsAI(params: { country: string; region?: string; stateProvince?: string; city?: string; q?: string }) {
    const country = normalizeCountry(params.country);
    const region = params.region || params.stateProvince || '';
    const city = params.city || '';
    const query = params.q || '';

    const fallback: { boards: BoardHit[] } = { boards: [] };

    // curated fallbacks (small, AI expands)
    const key = `${country.toLowerCase()}|${region.toLowerCase()}|${city.toLowerCase()}`;
    if (key.includes('canada') && region.toLowerCase().startsWith('ont')) {
      fallback.boards = [
        { name: 'Toronto District School Board', url: 'https://www.tdsb.on.ca', score: 0.99 },
        { name: 'Peel District School Board', url: 'https://www.peelschools.org', score: 0.96 },
        { name: 'York Region District School Board', url: 'https://www2.yrdsb.ca', score: 0.95 },
        { name: 'Ottawa-Carleton District School Board', url: 'https://ocdsb.ca', score: 0.92 },
      ];
    } else if (key.includes('united states') && city.toLowerCase().includes('new york')) {
      fallback.boards = [
        { name: 'New York City Department of Education', url: 'https://www.schools.nyc.gov', score: 0.99 },
      ];
    } else if (key.includes('united kingdom')) {
      fallback.boards = [
        { name: 'Department for Education (England)', url: 'https://www.gov.uk/government/organisations/department-for-education', score: 0.8 },
      ];
    } else if (key.includes('australia') && region.toLowerCase().includes('new south wales')) {
      fallback.boards = [
        { name: 'NSW Department of Education', url: 'https://education.nsw.gov.au', score: 0.95 },
      ];
    }

    const prompt = `
Return JSON only. You help teachers find their school board/district/trust.
Inputs:
- country="${country}"
- region="${region}"
- city="${city}"
- keywords="${query}"
Respond as: { "boards": [ { "name": string, "url": string|null, "score": number } ] }`;

    const json = await this.ai.json<{ boards: BoardHit[] }>(prompt, fallback);
    return { boards: Array.isArray(json?.boards) ? json.boards : fallback.boards };
  }

  /** AI bootstrap */
  async aiBootstrap({ country, region, stateProvince, city, board }: any) {
    const normCountry = normalizeCountry(country);
    const reg = region || stateProvince || '';

    const fall = defaultsByCountry(normCountry, reg);
    const fallLs = defaultLs(normCountry, reg);

    const prompt = `
Return JSON only.
- country="${normCountry}"
- region="${reg}"
- city="${city || ''}"
- board="${board || ''}"
Respond strictly as:
{
  "lsCategories":[{"id":string,"label":string}...],
  "subjects":[string...],
  "gradeBands":[string...]
}`;

    const guess = await this.ai.json<{ lsCategories?: LsCat[]; subjects?: string[]; gradeBands?: string[] }>(prompt, {
      lsCategories: fallLs,
      subjects: fall.subjects,
      gradeBands: fall.gradeBands,
    });

    const ls: LsCat[] = (Array.isArray(guess.lsCategories) && guess.lsCategories.length ? guess.lsCategories : fallLs)
      .map(x => {
        const label = String(x?.label ?? '').trim();
        const id = slug(String(x?.id ?? label));
        return label ? { id, label } : null;
      })
      .filter(Boolean) as LsCat[];

    const subjects = uniqStrings(Array.isArray(guess.subjects) && guess.subjects.length ? guess.subjects : fall.subjects);
    const gradeBands = uniqStrings(Array.isArray(guess.gradeBands) && guess.gradeBands.length ? guess.gradeBands : fall.gradeBands);

    const saved = await this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        jurisdiction: suggestJurisdiction(normCountry, reg),
        board: board || null,
        lsCategories: ls as any,
        subjects: subjects as any,
        gradeBands: gradeBands as any,
      },
      create: {
        id: 'singleton',
        jurisdiction: suggestJurisdiction(normCountry, reg),
        board: board || null,
        lsCategories: ls as any,
        subjects: subjects as any,
        gradeBands: gradeBands as any,
        terms: 3,
      },
    });

    await this.syncLearningSkillsToExistingSet(saved.lsCategories as any);
    return saved;
  }
}