import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OpenAIService } from '../ai/openai.service';

type Level = 'E' | 'G' | 'S' | 'NS' | 'NextSteps' | 'END';

type CrudDelegate = {
  findMany: (args?: any) => Promise<any[]>;
  findFirst?: (args?: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  update?: (args: any) => Promise<any>;
};

function slugify(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService, private ai: OpenAIService) {}

  private LEVELS: Level[] = ['E', 'G', 'S', 'NS', 'NextSteps', 'END'];

  private loadLevelEmoji(): Record<string, string> {
    try {
      if (process.env.LEVEL_EMOJI_JSON) {
        const parsed = JSON.parse(process.env.LEVEL_EMOJI_JSON);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return { E: '🟢', G: '🟡', S: '🟠', NS: '🔴', NextSteps: '🧭', END: '🏁' };
  }
  private LEVEL_EMOJI = this.loadLevelEmoji();

  // -------- delegates / tenant helpers --------

  private commentDelegate(): { name: string; api: CrudDelegate } {
    const p: any = this.prisma as any;
    const keys = Object.keys(p).filter((k) => !k.startsWith('$'));
    const candidates = keys
      .filter((k) => /comment/i.test(k) && typeof p[k]?.findMany === 'function' && typeof p[k]?.create === 'function')
      .sort((a, b) => a.length - b.length);
    const key = candidates[0];
    if (!key) {
      throw new Error(
        `No Prisma model delegate found for comments. Tried: ${keys
          .filter((k) => !k.startsWith('$'))
          .join(', ')}.`,
      );
    }
    return { name: key, api: p[key] as CrudDelegate };
  }

  private tenantDelegate():
    | { name: string; api: { findUnique?: Function; findFirst?: Function; create?: Function } }
    | null {
    const p: any = this.prisma as any;
    const candidates = ['tenant', 'tenants', 'schoolTenant', 'orgTenant', 'organizationTenant'].filter(
      (k) => p[k] && typeof p[k] === 'object',
    );
    if (candidates.length === 0) return null;
    return { name: candidates[0], api: p[candidates[0]] };
  }

  private async resolveTenantConnect(): Promise<{ tenant: { connect: { id: any } } } | null> {
    const td = this.tenantDelegate();
    if (!td) return null;
    const t: any = td.api;

    try {
      if (typeof t.findUnique === 'function') {
        const def = await t.findUnique({ where: { id: 'default' } });
        if (def?.id != null) return { tenant: { connect: { id: def.id } } };
      }
    } catch {}
    try {
      if (typeof t.findFirst === 'function') {
        const first = await t.findFirst();
        if (first?.id != null) return { tenant: { connect: { id: first.id } } };
      }
    } catch {}
    try {
      if (typeof t.create === 'function') {
        try {
          const created = await t.create({ data: { id: 'default', name: 'Default' } });
          if (created?.id != null) return { tenant: { connect: { id: created.id } } };
        } catch {
          const created = await t.create({ data: { name: 'Default' } });
          if (created?.id != null) return { tenant: { connect: { id: created.id } } };
        }
      }
    } catch {}
    return null;
  }

  // -------- level helpers --------

  private extractLevel(row: any): { level: Level | null; emoji: string | null } {
    let lvl: string | null = null;

    if (row && typeof row.level === 'string') lvl = row.level;

    if (!lvl) {
      const t = row?.tags;
      const tags: string[] = Array.isArray(t)
        ? t
        : typeof t === 'string'
          ? t.split(',').map((s) => s.trim())
          : [];
      const tag = tags.find((x) => x.toLowerCase().startsWith('level:'));
      if (tag) {
        const v = tag.split(':')[1];
        if (v) lvl = v;
      }
    }

    const norm = this.LEVELS.includes(lvl as Level) ? (lvl as Level) : null;
    const emoji = norm ? (this.LEVEL_EMOJI[norm] || null) : null;
    return { level: norm, emoji };
  }

  private withLevelTag(tags: string[] | null | undefined, level?: Level | null) {
    const base = Array.isArray(tags) ? tags.slice() : [];
    if (level && !base.some((t) => t.toLowerCase().startsWith('level:'))) base.push(`level:${level}`);
    return Array.from(new Set(base));
  }

  private inferLevelFromText(text: string): Level | null {
    if (/(next step|should|encouraged to|would benefit)/i.test(text)) return 'NextSteps';
    if (/(needs|requires|finds it challenging|avoids|with modified timelines)/i.test(text)) return 'NS';
    if (/(developing|with (some|occasional) reminders|emerging|benefits from)/i.test(text)) return 'S';
    if (/(consistently|reliably|always|regularly)/i.test(text)) return 'G';
    if (/(exemplary|outstanding|exceptional|beyond requirements|lead(er|ership))/i.test(text)) return 'E';
    if (/best of luck|successful year|strong start/i.test(text)) return 'END';
    return null;
  }

  // -------- resilient fetching (never 500 on include names) --------

  private async listQueryVariants(api: CrudDelegate) {
    try {
      return await api.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { skills: { include: { skill: true } } },
      });
    } catch {}

    try {
      return await api.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { CommentTemplateSkill: { include: { StandardSkill: true } } } as any,
      });
    } catch {}

    try {
      return await api.findMany({ orderBy: { updatedAt: 'desc' } });
    } catch {}

    try {
      return await api.findMany({ orderBy: { id: 'desc' } });
    } catch {}

    return await api.findMany();
  }

  private normalizeRow(row: any) {
    let skills: Array<{ skill: any }> | undefined;

    if (Array.isArray(row?.skills)) {
      skills = row.skills.map((x: any) => (x?.skill ? { skill: x.skill } : x)).filter(Boolean);
    }
    if (!skills && Array.isArray(row?.CommentTemplateSkill)) {
      skills = row.CommentTemplateSkill
        .map((x: any) => (x?.StandardSkill ? { skill: x.StandardSkill } : null))
        .filter(Boolean);
    }

    return {
      ...row,
      ...(skills ? { skills } : {}),
      ...this.extractLevel(row),
    };
  }

  // ---------- CRUD ----------

  async list(opts?: { level?: Level | 'all' | '' | null; q?: string | null }) {
    const { api } = this.commentDelegate();
    const rows = await this.listQueryVariants(api);
    let out = rows.map((r: any) => this.normalizeRow(r));

    if (opts?.q) {
      const q = String(opts.q || '').toLowerCase();
      out = out.filter((r: any) => String(r.text || '').toLowerCase().includes(q));
    }

    const lv = opts?.level ?? null;
    if (lv && String(lv) !== 'all' && String(lv) !== '') {
      out = out.filter((r: any) => r.level === (lv as Level));
    }

    return out;
  }

  private async tryCreate(api: CrudDelegate, data: any) {
    try { return await api.create({ data }); } catch (e: any) {
      const msg = String(e?.message || '');
      if (/updatedAt/i.test(msg) && /missing/i.test(msg)) {
        const withTs = { ...data, updatedAt: new Date() };
        return await api.create({ data: withTs });
      }
      throw e;
    }
  }

  async create(body: any) {
    const { api } = this.commentDelegate();
    const base: any = {
      subject: body?.subject ?? null,
      gradeBand: body?.gradeBand ?? null,
      text: String(body?.text || '').trim(),
    };
    if (!base.text) throw new Error('Text is required');

    const rawTags = Array.isArray(body?.tags) ? body.tags : [];
    const level: Level | null = this.LEVELS.includes(body?.level as Level) ? (body.level as Level) : null;
    const tags = this.withLevelTag(rawTags, level);
    const tenantConnect = await this.resolveTenantConnect();

    const variants = [
      { ...base, tags, ...(level ? { level } : {}), ...(tenantConnect || {}) },
      { ...base, tags, ...(tenantConnect || {}) },
      { ...base, ...(level ? { level } : {}), ...(tenantConnect || {}) },
      { ...base, ...(tenantConnect || {}) },
      { ...base, tags },
      { ...base },
    ];

    let created: any;
    let lastErr: any;
    for (const data of variants) {
      try { created = await this.tryCreate(api, data); break; } catch (e) { lastErr = e; }
    }
    if (!created) throw lastErr;

    return this.normalizeRow(created);
  }

  async remove(id: string) {
    const { api } = this.commentDelegate();
    try {
      return await api.delete({ where: { id } as any });
    } catch {
      const n = Number(id);
      if (!Number.isNaN(n)) {
        try { return await api.delete({ where: { id: n } as any }); } catch {}
      }
      throw new Error('Delete failed: unknown id shape for comment model');
    }
  }

  // ---------- NEW: by-skill for student generator ----------

  async getBySkill(skill: string, level?: Level | null) {
    const { api } = this.commentDelegate();
    const rows = await this.listQueryVariants(api);
    const slug = slugify(skill);

    const norm = rows.map((r: any) => this.normalizeRow(r));

    const out = norm.filter((r: any) => {
      // Collect tags (array or CSV)
      const tags: string[] = Array.isArray(r.tags)
        ? r.tags
        : typeof r.tags === 'string'
          ? (r.tags as string).split(',').map((s) => s.trim())
          : [];

      const hasCatTag = tags.some((t) => t.toLowerCase() === `category:${slug}`);

      // Look at included StandardSkill.category (human label)
      const hasSkillCat =
        Array.isArray(r.skills) &&
        r.skills.some((s: any) => slugify(String(s?.skill?.category || '')) === slug);

      // Some datasets may pass a skill id (rare)
      const idMatch =
        Array.isArray(r.skills) &&
        r.skills.some((s: any) => String(s?.skill?.id || '').toLowerCase() === skill.toLowerCase());

      return hasCatTag || hasSkillCat || idMatch;
    });

    const filtered = level ? out.filter((r) => r.level === level) : out;

    // order newest first by updatedAt then id
    filtered.sort((a: any, b: any) => {
      const au = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bu = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (bu !== au) return bu - au;
      return String(b?.id ?? '').localeCompare(String(a?.id ?? ''));
    });

    return filtered;
  }

  // ---------- AI ----------

  async generate(body: {
    subject?: string | null;
    gradeBand?: string | null;
    skillIds?: string[];
    tone?: 'positive' | 'formal' | 'growth' | 'concise';
    length?: 'short' | 'medium' | 'long';
    placeholders?: string[];
    level?: Level | null;
    targetLevel?: Level | null;
  }) {
    const tone = body?.tone ?? 'positive';
    const length = body?.length ?? 'medium';
    const subject = body?.subject ?? null;
    const gradeBand = body?.gradeBand ?? null;
    const placeholders = Array.isArray(body?.placeholders) ? body.placeholders : [];

    const chosenLevel: Level | null =
      this.LEVELS.includes(body?.level as Level)
        ? (body?.level as Level)
        : this.LEVELS.includes(body?.targetLevel as Level)
          ? (body?.targetLevel as Level)
          : null;

    const prompt = `
Write one teacher report-card comment sentence in ${tone} tone and ${length} length.
Use ONLY these placeholders if needed: ${JSON.stringify(placeholders)}.
Context: ${subject ? `subject=${subject};` : ''} ${gradeBand ? `gradeBand=${gradeBand};` : ''} ${chosenLevel ? `level=${chosenLevel};` : ''}

Rules:
- Use gender-neutral placeholders ({{he_she}}, {{him_her}}, {{his_her}}, {{they}}, {{them}}, {{their}}) when needed.
- Prefer {{student_first}} to refer to the student.
- Single sentence. Specific and helpful.
Return JSON: {"text": "..."} only.`.trim();

    const fallback = {
      text:
        subject
          ? `{{student_first}} showed steady growth in ${subject} this term and would benefit from focusing on {{next_step}}.`
          : `{{student_first}} demonstrated positive learning habits this term and should continue to build on {{strength}}.`,
    };

    const json = await this.ai.json<{ text: string }>(prompt, fallback);
    const text = (json?.text || fallback.text).trim();
    const emoji = chosenLevel ? (this.LEVEL_EMOJI[chosenLevel] || null) : null;

    return { text, level: chosenLevel, emoji };
  }

  getLevelsMapping() {
    return { levels: this.LEVELS, emoji: this.LEVEL_EMOJI };
  }

  // ---------- Summary ----------

  async summary() {
    const { api } = this.commentDelegate();
    const rows = await this.listQueryVariants(api);
    const norm = rows.map((r: any) => this.normalizeRow(r));

    const byLevel: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const r of norm) {
      const lv = r.level || '(none)';
      byLevel[lv] = (byLevel[lv] || 0) + 1;

      const tagCats: string[] = Array.isArray(r.tags)
        ? (r.tags as string[]).filter((t) => String(t).toLowerCase().startsWith('category:'))
        : typeof r.tags === 'string'
          ? (r.tags as string).split(',').map((s) => s.trim()).filter((t) => t.toLowerCase().startsWith('category:'))
          : [];

      if (tagCats.length) {
        for (const t of tagCats) {
          const slug = t.split(':')[1] || 'unknown';
          byCategory[slug] = (byCategory[slug] || 0) + 1;
        }
      } else if (Array.isArray(r.skills) && r.skills.length) {
        for (const sk of r.skills) {
          const lab = String(sk?.skill?.category || '').trim();
          if (lab) {
            const s = slugify(lab);
            byCategory[s] = (byCategory[s] || 0) + 1;
          }
        }
      }
    }

    return {
      total: norm.length,
      byLevel,
      byCategory,
      levels: this.LEVELS,
      emoji: this.LEVEL_EMOJI,
    };
  }

  // ---------- Ontario dataset / seeding / backfills ----------

  private readonly ONTARIO_DATA: Record<string, Array<[Level, string]>> = {
    Responsibility: [
      ['E', '{Name} consistently engages in lessons and contributes meaningfully to discussions.'],
      ["E", "{Name}'s regular participation enriches our class dialogues."],
      ['E', '{Name} demonstrates attentive listening through maintained eye contact and focused posture.'],
      ['E', 'During discussions, {Name} avoids distractions and models active listening strategies.'],
      ['E', '{Name} fosters a welcoming environment by valuing diverse perspectives.'],
      ['E', '{Name} consistently shows care and inclusivity toward classmates.'],
      ['E', '{Name} sets an exemplary standard by taking ownership of {hishertheir} actions and treating peers with respect.'],
      ['E', 'As a class leader, {Name} balances integrity with kindness in all interactions.'],
      ['E', '{Name} reliably submits high-quality work ahead of deadlines, often going beyond requirements.'],
      ['E', 'Assignments from {Name} are consistently thorough and punctual.'],
      ['E', '{Name} proactively organizes {hishertheir} tasks with impressive independence.'],
      ['E', '{Name} anticipates next steps and manages responsibilities without reminders.'],
      ['E', '{Name} upholds classroom norms while guiding peers through positive example.'],
      ['E', '{Name} naturally assumes leadership roles through {hishertheir} consistent reliability.'],
      ['G', '{Name} consistently reflects before speaking up in class, making sure {hishertheir} contributions stay focused and relevant.'],
      ['G', 'All assigned work gets completed and turned in punctually by {Name}, meeting every deadline.'],
      ['G', 'In every classroom setting, {Name} maintains respectful and considerate behavior at all times.'],
      ['G', 'With little need for prompting, {Name} reliably follows all classroom procedures and expectations.'],
      ['G', 'During discussions, {Name} demonstrates excellent patience, always waiting to be acknowledged before sharing {hishertheir} thoughts.'],
      ['G', '{Name} consistently fulfills requirements while taking full ownership of {hishertheir} choices and actions.'],
      ['S', '{Name} submits classwork and homework assignments when given periodic reminders to do so.'],
      ['S', '{Name} maintains proper conduct during lessons and breaks, though sometimes needs gentle prompts from staff.'],
      ['S', 'While {Name} accepts responsibility for {hishertheir} actions at times, {heSheThey} benefits from occasional redirection to remain focused.'],
      ['S', '{Name} turns in assignments by deadlines but would benefit from double-checking requirements to ensure {hishertheir} work meets all expectations.'],
      ['S', '{Name} demonstrates emerging responsibility in task completion, though consistency improves with regular check-ins.'],
      ['S', 'With some teacher prompting, {Name} adheres to our collaboratively established classroom rules and school policies.'],
      ['NS', '{Name} submits completed assignments when given both reminders and adjusted deadlines to support {himherthem}.'],
      ['NS', '{Name} finds it challenging to consistently meet academic obligations and classroom expectations.'],
      ['NS', '{Name} needs frequent guidance from staff to maintain appropriate conduct during instructional time.'],
      ['NS', '{Name} has shown gradual improvement in behavior during lessons and breaks, and should keep focusing on this progress.'],
      ['NS', '{Name} regularly needs assistance to complete work by deadlines and manage academic responsibilities.'],
      ['NS', 'With modified timelines and teacher support, {Name} is able to finish certain assignments and classroom tasks.'],
      ['NextSteps', '{Name} should help with classroom jobs more regularly to maintain a neat workspace.'],
      ['NextSteps', '{Name} is encouraged to return materials properly and assist with cleanup independently.'],
      ['NextSteps', '{Name} needs to focus on working independently with appropriate behavior during all school times.'],
      ['NextSteps', '{Name} should verify {hishertheir} schedule and materials before each class.'],
      ['NextSteps', '{Name} is encouraged to plan ahead and manage {hishertheir} tasks more proactively.'],
      ['NextSteps', '{Name} should ask for help sooner while working on completing tasks independently.'],
      ['NextSteps', '{Name} is encouraged to use a planner or app to track assignments and due dates.'],
    ],
    Organization: [
      ['E', '{Name} skillfully creates and executes effective strategies for tackling assignments across all subjects, whether through study guides, graphic organizers, or other planning methods.'],
      ['E', '{Name} never fails to come prepared with all necessary supplies for each class session.'],
      ['E', '{Name} reliably utilizes digital platforms like Google Classroom or traditional planners to stay on top of upcoming deadlines and school events.'],
      ['E', '{Name} demonstrates exceptional time-management skills, consistently prioritizing tasks to submit high-quality work by deadlines.'],
      ['E', '{Name} effectively locates, assesses, and applies various resources and information to successfully complete academic work, including digital tools and assignment rubrics.'],
      ['G', '{Name} consistently submits assignments properly formatted and punctually.'],
      ['G', '{Name} effectively organizes {hishertheir} workload to meet all deadlines successfully.'],
      ['G', 'Across all subjects, {Name} develops and follows practical approaches to complete work, demonstrating good time management.'],
      ['G', '{Name} skillfully locates, collects, and assesses relevant materials to accomplish academic tasks.'],
      ['G', '{Name} reliably arrives at each class session equipped with the appropriate learning materials and supplies.'],
      ['S', '{Name} is making progress in maintaining better organization of {hishertheir} study materials and personal workspace.'],
      ['S', 'When engaged by a topic, {Name} creates effective work plans, though benefits from additional guidance with more challenging or less preferred subjects.'],
      ['S', '{Name} capably researches using digital tools, and is developing skills to better assess the quality of information sources.'],
      ['S', 'With occasional reminders, {Name} brings most necessary materials to class sessions.'],
      ['S', '{Name} utilizes Google Classroom effectively to monitor some important dates and tasks.'],
      ['NS', '{Name} works well independently on straightforward tasks when the subject matter captures {hishertheir} interest.'],
      ['NS', 'With individualized or small-group support from the teacher, {Name} consistently meets assignment deadlines.'],
      ['NS', 'While {Name} utilizes Google Classroom for coursework, {heSheThey} would benefit from checking it more frequently to stay current with assessments and deadlines.'],
      ['NS', '{Name} demonstrates the ability to research topics of personal interest using technology, though should continue developing skills to verify source reliability.'],
      ['NextSteps', '{Name} should review the schedule before leaving {hishertheir} locker to confirm all necessary class materials are packed.'],
      ['NextSteps', '{Name} must remember to transport homework between home and school reliably.'],
      ['NextSteps', '{Name} is encouraged to maintain better organization of {hishertheir} notes, binders, and locker space.'],
      ['NextSteps', '{Name} would benefit from prioritizing tasks and improving time management to meet deadlines consistently.'],
      ['NextSteps', '{Name} should verify the reliability of sources when conducting research.'],
      ['NextSteps', '{Name} needs to consistently create and follow structured plans to complete work punctually.'],
    ],
    'Independent Work': [
      ['E', '{Name} demonstrates excellent initiative by starting assignments promptly and maintaining strong focus during independent work sessions.'],
      ['E', '{Name} consistently follows both verbal and written directions for classroom activities and assignments with accuracy.'],
      ['E', '{Name} makes productive use of any extra class time to further {hishertheir} learning or complete additional work.'],
      ['E', '{Name} effectively tracks and adjusts {hishertheir} work strategies to accomplish tasks and meet personal objectives.'],
      ['E', '{Name} maintains consistent focus on assignments and transitions independently between tasks as needed.'],
      ['G', '{Name} demonstrates excellent initiative by beginning tasks promptly after directions are given, requiring little teacher guidance.'],
      ['G', '{Name} maintains strong focus during lessons, showing good resistance to classroom distractions.'],
      ['G', '{Name} follows instructions carefully and transitions to subsequent activities at the proper times.'],
      ['G', '{Name} effectively reviews and adjusts {hishertheir} work strategies to ensure timely task completion.'],
      ['G', '{Name} would benefit from consistently referring to grading rubrics and success criteria to better meet assignment expectations.'],
      ['S', '{Name} is developing better time management skills, particularly for shorter, well-defined assignments.'],
      ['S', 'While {Name} sometimes checks {hishertheir} progress, {heSheThey} benefits from teacher guidance to adjust {hishertheir} approach and maintain focus.'],
      ['S', '{Name} produces {hishertheir} best work in quieter settings where {heSheThey} can concentrate without peer distractions.'],
      ['S', 'With teacher prompting, {Name} starts tasks and utilizes class time productively.'],
      ['S', '{Name} follows directions when given reminders and support from the instructor.'],
      ['NS', '{Name} is developing strategies to minimize social interactions during independent work, helping {himherthem} finish assignments accurately and punctually.'],
      ['NS', '{Name} benefits from periodic teacher reminders to maintain focus and limit distractions during work time.'],
      ['NS', 'In a quiet environment with adult supervision, {Name} demonstrates the ability to concentrate and work productively for brief intervals.'],
      ['NS', '{Name} is learning to implement organizational supports like timers and task lists to improve {hishertheir} independent work habits.'],
      ['NS', '{Name} requires one-on-one teacher assistance to successfully complete assignments by their deadlines.'],
      ['NextSteps', '{Name} should prioritize assignments and plan time effectively to work at a steady pace without rushing.'],
      ['NextSteps', '{Name} is encouraged to stay focused during class time and minimize distractions.'],
      ['NextSteps', '{Name} would benefit from setting clear goals before beginning independent work to maintain motivation.'],
      ['NextSteps', '{Name} should develop the habit of reviewing instructions carefully before starting assignments to prevent mistakes.'],
      ['NextSteps', '{Name} is encouraged to incorporate short, scheduled breaks to sustain concentration during longer tasks.'],
      ['NextSteps', '{Name} should practice dividing complex assignments into smaller parts to make them more manageable.'],
      ['NextSteps', '{Name} would work more effectively by choosing quiet classroom areas with fewer distractions.'],
    ],
    Collaboration: [
      ['E', "{Name} thoughtfully considers peers' perspectives during both small-group and whole-class discussions."],
      ['E', '{Name} flexibly assumes different group roles and fosters inclusivity among classmates.'],
      ['E', '{Name} proactively shares knowledge and tools to support collaborative problem-solving.'],
      ['E', '{Name} enthusiastically engages in all group activities, readily adapting to assigned roles.'],
      ['E', "{Name} naturally guides teams toward objectives while elevating peers' contributions."],
      ['G', '{Name} reliably fulfills {hishertheir} responsibilities in group projects.'],
      ['G', '{Name} cultivates positive peer relationships through respectful interactions.'],
      ['G', '{Name} exchanges ideas and materials effectively during partnered tasks.'],
      ['G', '{Name} navigates group dynamics constructively to resolve disagreements.'],
      ['G', '{Name} finds joy in teamwork while maintaining equal participation.'],
      ['S', '{Name} contributes quietly but consistently to small-group work with prompts.'],
      ['S', '{Name} collaborates more openly when grouped with preferred peers.'],
      ['S', '{Name} shares limited input during collaborations, often assuming observer roles.'],
      ['S', '{Name} requires occasional guidance to complete group assignment components.'],
      ['S', '{Name} is expanding {hishertheir} comfort working with diverse classmates.'],
      ['NS', '{Name} is gaining confidence to undertake varied group roles and leadership.'],
      ['NS', '{Name} practices conflict-resolution strategies during peer interactions.'],
      ['NS', '{Name} thrives in collaborative settings with direct teacher facilitation.'],
      ['NextSteps', "{Name} should listen carefully to group members and stay open to others' ideas."],
      ['NextSteps', '{Name} is encouraged to try different roles (leader/supporter) in group work.'],
      ['NextSteps', "{Name} would benefit from speaking up more in class to build understanding and confidence."],
      ['NextSteps', "{Name} should keep practicing ways to solve group disagreements peacefully."],
      ['NextSteps', '{Name} is encouraged to share ideas more often during discussions.'],
    ],
    Initiative: [
      ['E', '{Name} approaches unfamiliar challenges with enthusiasm and a growth mindset.'],
      ['E', '{Name} proactively pursues additional learning opportunities beyond assigned tasks.'],
      ['E', '{Name} exhibits authentic fascination with cross-curricular topics through thoughtful questions.'],
      ['E', '{Name} initiates involvement in school activities and reliably honors commitments.'],
      ['E', '{Name} actively incorporates feedback to refine {hishertheir} work, demonstrating intellectual humility.'],
      ['G', '{Name} maintains natural curiosity about new concepts and skills.'],
      ['G', '{Name} engages with novel topics by seeking clarification and deeper understanding.'],
      ['G', '{Name} applies instructor suggestions to enhance {hishertheir} academic performance.'],
      ['G', '{Name} volunteers for classroom roles and completes them responsibly.'],
      ['G', '{Name} is developing the habit of using rubrics to guide {hishertheir} work.'],
      ['S', '{Name} shows particular interest in specific subject areas, asking relevant questions.'],
      ['S', 'With encouragement, {Name} adopts a constructive approach to new learning experiences.'],
      ['S', '{Name} works most productively on unfamiliar tasks with peer collaboration or teacher support.'],
      ['S', '{Name} participates in classroom jobs but benefits from progress check-ins.'],
      ['NS', '{Name} engages positively only with select high-interest topics.'],
      ['NS', '{Name} is building independence in problem-solving before seeking assistance.'],
      ['NS', '{Name} requires scaffolding to participate in extended learning activities.'],
      ['NS', '{Name} needs regular motivation and supervision to initiate tasks.'],
      ['NextSteps', '{Name} should approach new lessons with curiosity and optimism.'],
      ['NextSteps', '{Name} is encouraged to pursue extra learning challenges beyond requirements.'],
      ['NextSteps', "{Name} should try new activities before deciding they're too hard or boring."],
      ['NextSteps', '{Name} would benefit by connecting schoolwork to personal interests for better engagement.'],
      ['NextSteps', '{Name} is encouraged to participate more in classroom activities and events.'],
    ],
    'Self Regulation': [
      ['E', '{Name} formulates precise, insightful questions when seeking clarification, demonstrating independent thinking.'],
      ['E', '{Name} meets academic challenges with determination and a solutions-oriented mindset.'],
      ['E', '{Name} makes intentional decisions that support {hishertheir} learning objectives.'],
      ['E', '{Name} would benefit from embracing more ambitious learning targets to maximize {himselfherselfthemselves} potential.'],
      ['E', '{Name} should continue meticulous proofreading habits to achieve flawless final products.'],
      ['G', '{Name} establishes and tracks personal academic benchmarks.'],
      ['G', '{Name} appropriately requests help from staff or classmates when concepts are unclear.'],
      ['G', '{Name} recognizes effective learning tactics to accomplish {hishertheir} aims.'],
      ['G', '{Name} demonstrates self-awareness by articulating learning preferences and needs.'],
      ['G', '{Name} comfortably seeks teacher guidance and should maintain this productive habit.'],
      ['S', '{Name} works through difficulties successfully with individualized teacher support.'],
      ['S', '{Name} sometimes asks for help before attempting independent problem-solving strategies.'],
      ['S', '{Name} creates and pursues objectives primarily in preferred subject areas.'],
      ['S', '{Name} is developing perseverance skills and alternative approaches for challenging tasks.'],
      ['NS', '{Name} intermittently utilizes offered academic support.'],
      ['NS', '{Name} avoids difficult tasks but is learning coping strategies for academic hurdles.'],
      ['NS', '{Name} is working on maintaining composure when facing obstacles.'],
      ['NS', '{Name} requires scaffolding to establish and pursue measurable academic goals.'],
      ['NextSteps', '{Name} should try using classroom resources to solve problems independently before seeking help.'],
      ['NextSteps', '{Name} is encouraged to practice calming techniques (like deep breathing) to maintain focus'],
      ['NextSteps', '{Name} is urged to set ambitious goals and use spare class time productively'],
      ['NextSteps', '{Name} should reflect on personal strengths and needs to better communicate support requirements'],
    ],
    Conclusion: [
      ['END', "{{student_first}}, you've had a strong start to the year! Keep up the hard work."],
      ['END', "{{student_first}}, you've had a good start to the year. Keep working hard and I know we will see amazing results!"],
      ['END', 'I am happy to have you in my class this year and I am looking forward to seeing what you can accomplish!'],
      ['END', '{{student_first}}, you have had a successful first term. Keep up the good work!'],
      ['END', "{{student_first}}, you've had a successful year. Wishing you the best of luck next year!"],
      ['END', '{{student_first}}, you have been a positive role model for our classmates this year. Keep up the good work next year!'],
      ['END', '{{student_first}} has handled the challenges of this school year with grace and was a pleasure to teach. Best of luck next year!'],
    ],
  };

  /**
   * Seed (with UPSERT capability).
   * - mode "upsert" (default): update tags/level if text exists, else create
   * - mode "create": only create when not found
   */
  async seedOntarioLearningSkills(mode: 'create' | 'upsert' = 'upsert') {
    const { api } = this.commentDelegate();
    const tenantConnect = await this.resolveTenantConnect();

    const normalize = (s: string) =>
      s
        .replace(/\{Name\}/g, '{{student_first}}')
        .replace(/\{heSheThey\}/g, '{{he_she}}')
        .replace(/\{himherthem\}/g, '{{him_her}}')
        .replace(/\{hishertheir\}/g, '{{his_her}}')
        .replace(/\{himselfherselfthemselves\}/g, '{{their}}')
        .replace(/\{GRADE\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const updateExisting = async (row: any, tags: string[], level: Level | null) => {
      if (!row?.id) return false;
      const id = row.id;
      const data: any = { tags: Array.from(new Set(tags)) };
      if (level) data.level = level;

      const tryUpdate = async (where: any) => {
        if (typeof api.update === 'function') {
          try { await api.update({ where, data }); return true; } catch {}
        }
        return false;
      };

      if (await tryUpdate({ id })) return true;
      const n = Number(id);
      if (!Number.isNaN(n) && await tryUpdate({ id: n })) return true;
      return false;
    };

    const ensure = async (categoryLabel: string, level: Level, raw: string) => {
      const text = normalize(raw);
      if (!text) return { created: false, updated: false, skipped: true };

      const catSlug = slugify(categoryLabel);
      const baseTags = new Set<string>([
        'learning',
        'ontario',
        `ls:${categoryLabel}`,
        `category:${catSlug}`,
        `level:${level}`,
      ]);
      if (level === 'NextSteps') baseTags.add('next-steps');
      const tags = Array.from(baseTags);

      let existing: any | null = null;
      try {
        if (api.findFirst) {
          existing = await api.findFirst({ where: { text } });
        }
      } catch {}

      if (existing) {
        if (mode === 'upsert') {
          const ok = await updateExisting(existing, tags, level);
          return { created: false, updated: ok, skipped: !ok };
        }
        return { created: false, updated: false, skipped: true };
      }

      const variants = [
        () => this.tryCreate(api, { subject: null, gradeBand: null, text, tags, ...(tenantConnect || {}) }),
        () => this.tryCreate(api, { subject: null, gradeBand: null, text, ...(tenantConnect || {}) }),
        () => this.tryCreate(api, { subject: null, gradeBand: null, text, tags }),
        () => this.tryCreate(api, { subject: null, gradeBand: null, text }),
      ];

      for (const attempt of variants) {
        try { await attempt(); return { created: true, updated: false, skipped: false }; } catch {}
      }
      await this.tryCreate(api, { subject: null, gradeBand: null, text });
      return { created: true, updated: false, skipped: false };
    };

    let created = 0, updated = 0, skipped = 0;
    for (const [category, entries] of Object.entries(this.ONTARIO_DATA)) {
      for (const [lvl, raw] of entries) {
        const res = await ensure(category, lvl as Level, raw);
        if (res.created) created++;
        if (res.updated) updated++;
        if (res.skipped) skipped++;
      }
    }
    return { ok: true, mode, created, updated, skipped, total: created + updated + skipped };
  }

  /**
   * Backfill: for existing rows, if their normalized text matches the Ontario dataset,
   * add missing tags + level. Does not create new rows.
   */
  async backfillOntarioFromDataset() {
    const { api } = this.commentDelegate();

    const normalize = (s: string) =>
      String(s || '')
        .replace(/\{\s*student_first\s*\}/g, '{{student_first}}')
        .replace(/\{Name\}/g, '{{student_first}}')
        .replace(/\{heSheThey\}/g, '{{he_she}}')
        .replace(/\{himherthem\}/g, '{{him_her}}')
        .replace(/\{hishertheir\}/g, '{{his_her}}')
        .replace(/\{himselfherselfthemselves\}/g, '{{their}}')
        .replace(/\{GRADE\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const TEXT_MAP = new Map<string, { category: string; level: Level }>();
    for (const [category, items] of Object.entries(this.ONTARIO_DATA)) {
      for (const [level, raw] of items) {
        const key = normalize(raw);
        if (key) TEXT_MAP.set(key, { category, level });
      }
    }

    let updated = 0, skipped = 0, total = 0;

    let rows: any[] = [];
    try { rows = await api.findMany({ orderBy: { updatedAt: 'desc' } }); }
    catch { try { rows = await api.findMany({ orderBy: { id: 'desc' } }); } catch { rows = await api.findMany(); } }
    total = rows.length;

    const tryUpdate = async (row: any, data: any) => {
      if (!row?.id || typeof api.update !== 'function') return false;
      const id = row.id;
      try { await api.update({ where: { id }, data }); return true; } catch {}
      const n = Number(id); if (!Number.isNaN(n)) {
        try { await api.update({ where: { id: n }, data }); return true; } catch {}
      }
      return false;
    };

    for (const r of rows) {
      const key = normalize(r.text || '');
      const meta = TEXT_MAP.get(key);
      if (!meta) { skipped++; continue; }

      const current: string[] = Array.isArray(r.tags)
        ? r.tags.slice()
        : typeof r.tags === 'string'
          ? (r.tags as string).split(',').map((s) => s.trim()).filter(Boolean)
          : [];
      const low = current.map((t) => t.toLowerCase());
      const catSlug = slugify(meta.category);

      const needLs = !low.some((t) => t.startsWith('ls:'));
      const needCat = !low.some((t) => t.startsWith('category:'));
      const needLvl = !low.some((t) => t.startsWith('level:')) && !r.level;

      if (!needLs && !needCat && !needLvl) { skipped++; continue; }

      const next = new Set(current);
      if (needLs) next.add(`ls:${meta.category}`);
      if (needCat) next.add(`category:${catSlug}`);
      if (meta.level === 'NextSteps') next.add('next-steps');
      if (needLvl) next.add(`level:${meta.level}`);

      const data: any = { tags: Array.from(next) };
      if (!r.level) data.level = meta.level;

      const ok = await tryUpdate(r, data);
      if (ok) updated++; else skipped++;
    }

    return { ok: true, updated, skipped, total };
  }

  /** Heuristic tag backfill */
  async backfillOntarioCategoryTags() {
    const { api } = this.commentDelegate();
    let rows: any[] = [];
    try { rows = await api.findMany({ orderBy: { updatedAt: 'desc' } }); }
    catch { try { rows = await api.findMany({ orderBy: { id: 'desc' } }); } catch { rows = await api.findMany(); } }

    let updated = 0;

    const ONTARIO_SLUGS = new Set([
      'responsibility',
      'organization',
      'independent-work',
      'collaboration',
      'initiative',
      'self-regulation',
      'self regulation',
    ]);

    for (const r of rows) {
      const current: string[] = Array.isArray(r.tags)
        ? r.tags.slice()
        : typeof r.tags === 'string'
          ? (r.tags as string).split(',').map((s) => s.trim()).filter(Boolean)
          : [];

      const low = current.map((t) => t.toLowerCase());
      const hadCategory = low.some((t) => t.startsWith('category:'));
      const hadLs = low.some((t) => t.startsWith('ls:'));

      let catSlugFromLs: string | null = null;
      const lsTag = low.find((t) => t.startsWith('ls:'));
      if (lsTag) catSlugFromLs = slugify(lsTag.split(':').slice(1).join(':'));

      if (!hadCategory && (catSlugFromLs && ONTARIO_SLUGS.has(catSlugFromLs))) {
        current.push(`category:${catSlugFromLs}`);
      }

      const isNext =
        low.includes('next-steps') ||
        low.some((t) => t === 'level:nextsteps') ||
        /next|support|improv|goal|target|should|encouraged/i.test(String(r.text || ''));
      if (isNext && !low.includes('next-steps')) current.push('next-steps');

      const hasJurTag = low.some(
        (t) =>
          t.startsWith('jur:') ||
          t === 'ontario' ||
          t === 'canada' ||
          t === 'usa' ||
          t === 'united states' ||
          t === 'uk' ||
          t === 'united kingdom' ||
          t === 'australia',
      );
      const looksOntario =
        (hadLs && catSlugFromLs && ONTARIO_SLUGS.has(catSlugFromLs)) ||
        low.some((t) => t.startsWith('category:') && ONTARIO_SLUGS.has(slugify(t.split(':')[1] || '')));

      if (!hasJurTag && looksOntario) current.push('ontario');

      const nextUnique = Array.from(new Set(current));
      const changed =
        nextUnique.length !== (Array.isArray(r.tags) ? r.tags.length : current.length) ||
        (Array.isArray(r.tags) ? r.tags.join('|') : current.join('|')) !== nextUnique.join('|');

      if (!changed) continue;

      if (typeof api.update === 'function') {
        try {
          await api.update({ where: { id: r.id }, data: { tags: nextUnique } });
          updated++;
        } catch {
          const n = Number(r.id);
          if (!Number.isNaN(n)) {
            try {
              await api.update({ where: { id: n }, data: { tags: nextUnique } });
              updated++;
            } catch {}
          }
        }
      }
    }
    return { ok: true, updated };
  }
}