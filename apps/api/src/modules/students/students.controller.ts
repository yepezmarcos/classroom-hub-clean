import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type FlatGuardian = {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  relationship?: string | null;
};

@Controller('students')
export class StudentsController {
  constructor(private prisma: PrismaService) {}

  /** Resolve tenant id from req.user OR headers OR env (no assumptions). */
  private resolveTenantId(req: any): string {
    const fromUser = req?.user?.tenantId;
    const h = (req?.headers || {}) as Record<string, string | string[] | undefined>;
    const rawHeader = h['x-tenant-id'] ?? h['x-tenantid'] ?? (h['x_tenant_id'] as any);
    const fromHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const fromEnv = process.env.DEFAULT_TENANT_ID;
    const tenantId = (fromUser || fromHeader || fromEnv || '').trim();
    return tenantId;
  }

  /** One-time claim for legacy rows missing tenantId (safe no-op if already set). */
  private async claimLegacyForTenant(tenantId: string) {
    if (!tenantId) return;
    await this.prisma.$executeRaw`
      UPDATE "Student" SET "tenantId" = ${tenantId} WHERE "tenantId" IS NULL
    `;
    await this.prisma.$executeRaw`
      UPDATE "Guardian" SET "tenantId" = ${tenantId} WHERE "tenantId" IS NULL
    `;
    await this.prisma.$executeRaw`
      UPDATE "StudentGuardian" SET "tenantId" = ${tenantId} WHERE "tenantId" IS NULL
    `;
  }

  /** Flatten guardians for the UI: prefer explicit .guardians, otherwise from links. */
  private flattenGuardians(student: any): FlatGuardian[] {
    const fromLinks: FlatGuardian[] = (student?.links || [])
      .map((l: any) => ({
        id: l?.guardian?.id,
        name: l?.guardian?.name ?? '',
        email: l?.guardian?.email ?? null,
        phone: l?.guardian?.phone ?? null,
        relationship: l?.relationship ?? null,
      }))
      .filter((g: FlatGuardian) => g.name || g.email || g.phone);

    const existing = Array.isArray(student?.guardians) ? student.guardians : [];
    // De-dup by (email || name)
    const seen = new Set<string>();
    const result: FlatGuardian[] = [];
    for (const g of [...existing, ...fromLinks]) {
      const key = (g.email || g.name || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(g);
    }
    return result;
  }

  // -------------------------
  // LIST
  // -------------------------
  @Get()
  async list(@Req() req: any) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    await this.claimLegacyForTenant(tenantId);

    const students = await this.prisma.student.findMany({
      where: { tenantId },
      orderBy: [{ last: 'asc' }, { first: 'asc' }],
      include: {
        enrollments: { include: { classroom: true } },
        links: { include: { guardian: true } },
        grades: { include: { assignment: true } },
        notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    return students.map((s: any) => {
      const guardians = this.flattenGuardians(s);
      const emailLogs = (s.notes ?? []).filter(
        (n: any) =>
          Array.isArray(n.tags) &&
          (n.tags.includes('email') ||
            n.tags.includes('parent-email') ||
            n.tags.includes('guardian-email'))
      );
      return {
        ...s,
        guardians,          // <— NEW
        parents: guardians, // <— NEW alias some UIs expect
        emailLogs,
        communications: emailLogs,
      };
    });
  }

  // -------------------------
  // CREATE
  // -------------------------
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    const data: any = {
      tenantId,
      first: String(body.first || '').trim(),
      last: String(body.last || '').trim(),
      email: body.email || null,
      grade: body.grade || null,
      gender: body.gender || null,
      pronouns: body.pronouns || null,
      iep: !!body.iep,
      ell: !!body.ell,
      medical: !!body.medical,
    };
    if (!data.first || !data.last) {
      throw new BadRequestException('first and last are required');
    }

    const created = await this.prisma.student.create({ data });
    return created;
  }

  // -------------------------
  // SHOW (profile)
  // -------------------------
  @Get(':id')
  async show(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    // in case this row was legacy
    await this.prisma.$executeRaw`
      UPDATE "Student" SET "tenantId" = ${tenantId} WHERE "id" = ${id} AND "tenantId" IS NULL
    `;

    const student: any = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        enrollments: { include: { classroom: true } },
        links: { include: { guardian: true } },
        grades: { include: { assignment: true } },
        notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    const guardians = this.flattenGuardians(student);
    const emailLogs = (student.notes ?? []).filter(
      (n: any) =>
        Array.isArray(n.tags) &&
        (n.tags.includes('email') ||
          n.tags.includes('parent-email') ||
          n.tags.includes('guardian-email'))
    );

    return {
      ...student,
      guardians,          // <— NEW
      parents: guardians, // <— NEW alias some UIs expect
      emailLogs,
      communications: emailLogs,
    };
  }

  // -------------------------
  // PATCH
  // -------------------------
  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    const exists = await this.prisma.student.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundException('Student not found');

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        first: body.first ?? undefined,
        last: body.last ?? undefined,
        email: body.email ?? undefined,
        grade: body.grade ?? undefined,
        gender: body.gender ?? undefined,
        pronouns: body.pronouns ?? undefined,
        iep: body.iep ?? undefined,
        ell: body.ell ?? undefined,
        medical: body.medical ?? undefined,
      },
    });
    return updated;
  }

  // -------------------------
  // NOTES
  // -------------------------
  @Post(':id/notes')
  async addNote(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');

    const exists = await this.prisma.student.findFirst({ where: { id, tenantId } });
    if (!exists) throw new NotFoundException('Student not found');

    const note = await this.prisma.note.create({
      data: {
        tenantId,
        studentId: id,
        authorId: req?.user?.id ?? null,
        body: String(body.body || '').trim(),
        tags: Array.isArray(body.tags) ? body.tags : [],
      },
      include: { author: true },
    });
    return note;
  }

  // Manual hook you used earlier (kept)
  @Post('claim-legacy')
  async claimLegacy(@Req() req: any) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId) throw new BadRequestException('Missing tenant id');
    const updated = await this.prisma.$executeRaw`
      UPDATE "Student" SET "tenantId" = ${tenantId} WHERE "tenantId" IS NULL
    `;
    return { updated, tenantId };
  }
}