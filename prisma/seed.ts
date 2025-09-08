// apps/api/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureMembership(tenantId: string, userId: string, role: 'ADMIN'|'TEACHER'|'CO_TEACHER'|'PARENT') {
    const exists = await prisma.membership.findFirst({ where: { tenantId, userId } });
    if (!exists) {
        await prisma.membership.create({ data: { tenantId, userId, role } as any });
    }
}

async function main() {
    // 1) Tenant
    let tenant = await prisma.tenant.findFirst({ where: { name: 'Demo School' } });
    if (!tenant) tenant = await prisma.tenant.create({ data: { name: 'Demo School' } });

    // 2) Users
    const admin = await prisma.user.upsert({
        where: { email: 'admin@demo.edu' },
        update: {},
        create: { email: 'admin@demo.edu', name: 'Demo Admin' }
    });

    const teacher = await prisma.user.upsert({
        where: { email: 'teacher@demo.edu' },
        update: {},
        create: { email: 'teacher@demo.edu', name: 'Alex Teacher' }
    });

    // 3) Memberships
    await ensureMembership(tenant.id, admin.id, 'ADMIN');
    await ensureMembership(tenant.id, teacher.id, 'TEACHER');

    // 4) Settings (safe upsert – some schemas use a unique on tenantId)
    const priorSettings = await prisma.settings.findFirst({ where: { /* @ts-ignore */ tenantId: tenant.id } as any });
    if (!priorSettings) {
        await prisma.settings.create({
            data: {
                // Many schemas model Settings->tenant as a relation; this form works for both
                // If your schema only accepts tenantId, prisma will ignore the relation form.
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                jurisdiction: 'CA',
                board: 'Demo Board',
                lsCategories: ['E','G','S','NS'],
                subjects: ['Math','ELA','Science'],
                gradeBands: ['K-2','3-5','6-8'],
                terms: 3
            } as any
        });
    }

    // 5) Classrooms
    const homeroom = await prisma.classroom.upsert({
        where: { code: 'HRA-24' },
        update: {},
        create: {
            name: 'Homeroom A',
            code: 'HRA-24',
            // dual approach: relation connect if available, else tenantId
            // @ts-ignore
            tenant: { connect: { id: tenant.id } },
            tenantId: tenant.id
        } as any
    });

    const math = await prisma.classroom.upsert({
        where: { code: 'MATH-5A' },
        update: {},
        create: {
            name: 'Math A',
            code: 'MATH-5A',
            // @ts-ignore
            tenant: { connect: { id: tenant.id } },
            tenantId: tenant.id
        } as any
    });

    // 6) Students + Guardians + Enrollments
    const firstNames = ['Alex','Jess','Sam','Taylor','Jordan','Casey','Riley','Avery','Morgan','Drew'];
    const students = [];
    for (let i = 0; i < 10; i++) {
        const first = firstNames[i];
        const last = ['Rivera','Kim','Chen','Nguyen','Singh','Cohen','Garcia','Lee','Patel','Brown'][i];
        const s = await prisma.student.create({
            data: {
                first, last,
                grade: (5).toString(),
                email: null,
                gender: null,
                pronouns: 'they/them',
                iep: false, ell: false, medical: false,
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                tenantId: tenant.id
            } as any
        });
        students.push(s);

        // two guardians total across cohort (keeps it simple)
        const g = await prisma.guardian.create({
            data: {
                name: `${first} ${last} Parent`,
                email: `${first.toLowerCase()}.${last.toLowerCase()}@parents.example.com`,
                phone: '555-0100',
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                tenantId: tenant.id
            } as any
        });

        await prisma.studentGuardian.create({
            data: {
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                tenantId: tenant.id,
                student: { connect: { id: s.id } },
                guardian: { connect: { id: g.id } },
                relationship: 'Parent'
            } as any
        });

        // enroll in both classes
        await prisma.enrollment.create({
            data: {
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                tenantId: tenant.id,
                classroom: { connect: { id: homeroom.id } },
                student: { connect: { id: s.id } }
            } as any
        });
        await prisma.enrollment.create({
            data: {
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                tenantId: tenant.id,
                classroom: { connect: { id: math.id } },
                student: { connect: { id: s.id } }
            } as any
        });
    }

    // 7) Assignments + Grades (Math class)
    const a1 = await prisma.assignment.create({
        data: {
            title: 'Unit 1 Quiz',
            points: 20,
            dueAt: new Date(),
            // @ts-ignore
            tenant: { connect: { id: tenant.id } },
            tenantId: tenant.id,
            classroom: { connect: { id: math.id } }
        } as any
    });
    const a2 = await prisma.assignment.create({
        data: {
            title: 'Unit 1 Project',
            points: 50,
            dueAt: new Date(),
            // @ts-ignore
            tenant: { connect: { id: tenant.id } },
            tenantId: tenant.id,
            classroom: { connect: { id: math.id } }
        } as any
    });

    for (const s of students) {
        await prisma.grade.create({
            data: {
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                tenantId: tenant.id,
                assignment: { connect: { id: a1.id } },
                student: { connect: { id: s.id } },
                score: 15 + Math.floor(Math.random() * 6) // 15..20
            } as any
        });
        await prisma.grade.create({
            data: {
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                tenantId: tenant.id,
                assignment: { connect: { id: a2.id } },
                student: { connect: { id: s.id } },
                score: 35 + Math.floor(Math.random() * 16) // 35..50
            } as any
        });
    }

    // 8) Notes (a couple)
    for (const s of students.slice(0, 3)) {
        await prisma.note.create({
            data: {
                // @ts-ignore
                tenant: { connect: { id: tenant.id } },
                tenantId: tenant.id,
                student: { connect: { id: s.id } },
                body: `Quick note on ${s.first}: positive participation today.`,
                tags: ['Positive','Participation']
            } as any
        });
    }

    // 9) Comment templates (light)
    const tmpl = await prisma.commentTemplate.create({
        data: {
            // @ts-ignore
            tenant: { connect: { id: tenant.id } },
            tenantId: tenant.id,
            category: 'General',
            text: 'Shows consistent effort and is making steady progress.'
        } as any
    });

    await prisma.commentTemplateSkill.create({
        data: {
            // @ts-ignore
            tenant: { connect: { id: tenant.id } },
            tenantId: tenant.id,
            template: { connect: { id: tmpl.id } },
            label: 'Perseverance'
        } as any
    });

    console.log('✔ Seed complete');
}

main()
    .then(async () => { await prisma.$disconnect(); })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });