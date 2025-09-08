import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parse } from 'csv-parse/sync';
import crypto from 'node:crypto';

type Canonical = 'first'|'last'|'studentId'|'email'|'grade'|'pronouns'|'gender'|'guardianEmail'|'guardianName'|'guardianPhone';

const CANDIDATES: Record<Canonical,string[]> = {
    first: ['first','first name','fn','given','given name'],
    last: ['last','last name','ln','surname','family name'],
    studentId: ['student id','sid','student number','student #','id'],
    email: ['email','student email'],
    grade: ['grade','yr','year','homeroom'],
    pronouns: ['pronouns'],
    gender: ['gender','sex'],
    guardianEmail: ['parent email','guardian email','caregiver email'],
    guardianName: ['parent name','guardian name','caregiver name','guardian'],
    guardianPhone: ['parent phone','guardian phone','phone'],
};

function normalize(h: string) {
    return (h||'').toLowerCase().replace(/[_\-]/g,' ').replace(/\s+/g,' ').trim();
}
function guess(header: string): Canonical | null {
    const n = normalize(header);
    for (const key of Object.keys(CANDIDATES) as Canonical[]) {
        if (CANDIDATES[key].some(alias => n === alias || n.includes(alias))) return key;
    }
    // simple fallbacks
    if (n === 'name' || n.includes('student name')) return 'first';
    return null;
}

@Injectable()
export class RosterService {
    constructor(private prisma: PrismaService) {}

    previewCsv(tenantId: string, buf: Buffer) {
        // parse CSV into objects
        let rows: any[] = [];
        try {
            rows = parse(buf, { columns: true, skip_empty_lines: true, bom: true });
        } catch (e) {
            throw new BadRequestException('CSV parse failed');
        }
        const headers = rows.length ? Object.keys(rows[0]) : [];
        const mapping: Record<string,string> = {};
        for (const h of headers) {
            const g = guess(h);
            if (g) mapping[h] = g;
        }
        const sample = rows.slice(0, 20);
        return { ok: true, headers, mapping, sample, totalRows: rows.length };
    }

    async commit(
        tenantId: string,
        mapping: Record<string,string>,
        rows: any[],
        classroomCode: string,
        upsertClassroomName?: string,
    ) {
        if (!rows?.length) throw new BadRequestException('rows empty');

        const mInv: Record<string,string> = {};
        for (const [src, dst] of Object.entries(mapping)) mInv[dst] = src;

        const get = (row:any, canon: Canonical) => row[mInv[canon]] ?? null;

        // ensure classroom
        let classroom = await this.prisma.classroom.findFirst({ where: { tenantId, code: classroomCode }});
        if (!classroom) {
            classroom = await this.prisma.classroom.create({
                data: { id: crypto.randomUUID(), tenantId, code: classroomCode, name: upsertClassroomName || classroomCode }
            });
        }

        const results: any[] = [];
        for (const row of rows) {
            const first = (get(row,'first')||'').toString().trim();
            const last  = (get(row,'last')||'').toString().trim();
            if (!first && !last) continue;

            const studentEmail = (get(row,'email')||'').toString().trim() || null;
            const studentIdExt = (get(row,'studentId')||'').toString().trim() || null;
            const grade = (get(row,'grade')||'').toString().trim() || null;
            const pronouns = (get(row,'pronouns')||'').toString().trim() || null;
            const gender = (get(row,'gender')||'').toString().trim() || null;

            // upsert student (by email if present, else by pair first+last within tenant)
            let student = await this.prisma.student.findFirst({
                where: {
                    tenantId,
                    OR: [
                        ...(studentEmail ? [{ email: studentEmail }] : []),
                        { AND: [{ first }, { last }] }
                    ]
                }
            });
            if (!student) {
                student = await this.prisma.student.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenantId,
                        first, last,
                        email: studentEmail,
                        grade, pronouns, gender,
                        iep: false, ell: false, medical: false,
                    }
                });
            } else {
                // light update if new info available
                await this.prisma.student.update({
                    where: { id: student.id },
                    data: { email: studentEmail ?? student.email, grade, pronouns, gender }
                });
            }

            // guardian (optional)
            const gEmail = (get(row,'guardianEmail')||'').toString().trim() || null;
            const gName  = (get(row,'guardianName')||'').toString().trim() || null;
            const gPhone = (get(row,'guardianPhone')||'').toString().trim() || null;

            let guardianId: string | null = null;
            if (gEmail || gName) {
                const existing = await this.prisma.guardian.findFirst({
                    where: { tenantId, OR: [{ email: gEmail }, { name: gName }] }
                });
                const guardian = existing
                    ? await this.prisma.guardian.update({ where: { id: existing.id }, data: { email: gEmail ?? existing.email, name: gName ?? existing.name, phone: gPhone ?? existing.phone }})
                    : await this.prisma.guardian.create({ data: { id: crypto.randomUUID(), tenantId, email: gEmail, name: gName, phone: gPhone }});
                guardianId = guardian.id;

                // link student ↔ guardian if not linked
                const link = await this.prisma.studentGuardian.findFirst({
                    where: { tenantId, studentId: student.id, guardianId }
                });
                if (!link) {
                    await this.prisma.studentGuardian.create({
                        data: { id: crypto.randomUUID(), tenantId, studentId: student.id, guardianId, relationship: null }
                    });
                }
            }

            // enroll
            const enroll = await this.prisma.enrollment.findFirst({
                where: { tenantId, studentId: student.id, classroomId: classroom.id }
            });
            if (!enroll) {
                await this.prisma.enrollment.create({
                    data: { id: crypto.randomUUID(), tenantId, studentId: student.id, classroomId: classroom.id }
                });
            }

            results.push({ studentId: student.id, guardianId, classroomId: classroom.id });
        }

        return { ok: true, imported: results.length, classroom };
    }
}