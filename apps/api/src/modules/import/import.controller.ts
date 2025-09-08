import { Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import { parse } from 'csv-parse/sync';

type Mapping = {
  studentId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  grade?: string | null;
  email?: string | null;
  dob?: string | null;
  iep?: string | null;
  ell?: string | null;
  medical?: string | null;
  guardian1Name?: string | null;
  guardian1Email?: string | null;
  guardian1Phone?: string | null;
  guardian2Name?: string | null;
  guardian2Email?: string | null;
  guardian2Phone?: string | null;
  homeroom?: string | null;
  school?: string | null;
  classroom?: string | null;
};

@Controller('import')
@UseGuards(JwtGuard)
export class ImportController {
  constructor(private prisma: PrismaService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('file missing');

    const text = file.buffer.toString('utf8');
    const records: any[] = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    const columns = records.length ? Object.keys(records[0]) : [];
    const lc = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const guess = (name: string) => {
      const want: Record<string, string[]> = {
        studentId: ['studentid', 'id', 'studentnumber', 'osis', 'sisid'],
        firstName: ['firstname', 'first', 'given'],
        lastName: ['lastname', 'last', 'family', 'surname'],
        preferredName: ['preferred', 'nickname', 'prefname'],
        grade: ['grade', 'gradelevel', 'yr', 'year'],
        email: ['email', 'studentemail', 'mail'],
        dob: ['dob', 'dateofbirth', 'birthdate'],
        iep: ['iep', 'hasiep', 'specialed'],
        ell: ['ell', 'esl', 'englishlearner'],
        medical: ['medical', 'health', 'allergy'],
        guardian1Name: ['guardian', 'parent', 'guardian1', 'parent1', 'mother', 'father', 'contact1'],
        guardian1Email: ['guardianemail', 'parentemail', 'guardian1email', 'parent1email', 'contact1email'],
        guardian1Phone: ['guardianphone', 'parentphone', 'guardian1phone', 'parent1phone', 'contact1phone', 'phone'],
        guardian2Name: ['guardian2', 'parent2', 'contact2'],
        guardian2Email: ['guardian2email', 'parent2email', 'contact2email'],
        guardian2Phone: ['guardian2phone', 'parent2phone', 'contact2phone'],
        homeroom: ['homeroom', 'hr', 'teacher'],
        school: ['school', 'building', 'site'],
        classroom: ['class', 'classroom', 'section', 'course', 'period'],
      }[name] || [];

      for (const col of columns) if (want.includes(lc(col))) return col;
      return null;
    };

    const mapping: Mapping = {
      studentId: guess('studentId'),
      firstName: guess('firstName'),
      lastName: guess('lastName'),
      preferredName: guess('preferredName'),
      grade: guess('grade'),
      email: guess('email'),
      dob: guess('dob'),
      iep: guess('iep'),
      ell: guess('ell'),
      medical: guess('medical'),
      guardian1Name: guess('guardian1Name'),
      guardian1Email: guess('guardian1Email'),
      guardian1Phone: guess('guardian1Phone'),
      guardian2Name: guess('guardian2Name'),
      guardian2Email: guess('guardian2Email'),
      guardian2Phone: guess('guardian2Phone'),
      homeroom: guess('homeroom'),
      school: guess('school'),
      classroom: guess('classroom'),
    };

    return { columns, mapping, sample: records.slice(0, 20) };
  }

  @Post('commit')
  async commit(
    @Req() req: any,
    @Body() body: { mapping: Mapping; rows: any[]; createClasses?: boolean },
  ) {
    const { tenantId } = req.user;
    const m = body.mapping || {};
    const rows: any[] = body.rows || [];
    const results = {
      createdStudents: 0,
      updatedStudents: 0,
      createdGuardians: 0,
      createdEnrollments: 0,
      createdClasses: 0,
      errors: [] as string[],
    };

    for (const row of rows) {
      try {
        const first = m.firstName ? String(row[m.firstName] || '').trim() : '';
        const last = m.lastName ? String(row[m.lastName] || '').trim() : '';
        if (!first && !last) continue;

        const studentId = m.studentId ? String(row[m.studentId] || '').trim() : null;
        const email = m.email ? String(row[m.email] || '').trim() : null;
        const grade = m.grade ? String(row[m.grade] || '').trim() : null;
        const preferred = m.preferredName ? String(row[m.preferredName] || '').trim() : null;
        const dob = m.dob ? String(row[m.dob] || '').trim() : null;

        const flags = {
          iep: m.iep ? /^(y|yes|true|1)$/i.test(String(row[m.iep])) : false,
          ell: m.ell ? /^(y|yes|true|1)$/i.test(String(row[m.ell])) : false,
          medical: m.medical ? /^(y|yes|true|1)$/i.test(String(row[m.medical])) : false,
        };

        // School
        let schoolId: string | null = null;
        const schoolName = m.school ? String(row[m.school] || '').trim() : '';
        if (schoolName) {
          const school = await this.prisma.school.upsert({
            where: { tenantId_name: { tenantId, name: schoolName } },
            create: { tenantId, name: schoolName },
            update: {},
          });
          schoolId = school.id;
        }

        // Student upsert (prefer unique by studentId if present)
        const student = studentId
          ? await this.prisma.student.upsert({
              where: { tenantId_studentId: { tenantId, studentId } },
              create: { tenantId, studentId, first, last, preferred, email, grade, schoolId, dob, flags },
              update: { first, last, preferred, email, grade, schoolId, dob, flags },
            })
          : await this.prisma.student.create({
              data: { tenantId, first, last, preferred, email, grade, schoolId, dob, flags },
            });

        results[(studentId ? 'updatedStudents' : 'createdStudents') as 'createdStudents' | 'updatedStudents']++;

        // Guardians
        const g = [
          {
            name: m.guardian1Name ? String(row[m.guardian1Name] || '').trim() : '',
            email: m.guardian1Email ? String(row[m.guardian1Email] || '').trim() : '',
            phone: m.guardian1Phone ? String(row[m.guardian1Phone] || '').trim() : '',
          },
          {
            name: m.guardian2Name ? String(row[m.guardian2Name] || '').trim() : '',
            email: m.guardian2Email ? String(row[m.guardian2Email] || '').trim() : '',
            phone: m.guardian2Phone ? String(row[m.guardian2Phone] || '').trim() : '',
          },
        ].filter(x => x.name || x.email || x.phone);

        for (const gx of g) {
          const keyEmail = gx.email || `${student.id}-${gx.name || 'guardian'}@example.invalid`;

          const guardian = await this.prisma.guardian.upsert({
            where: { tenantId_email: { tenantId, email: keyEmail } },
            create: { tenantId, name: gx.name || 'Guardian', email: gx.email || null, phone: gx.phone || null, preferredLang: 'en' },
            update: { name: gx.name || undefined, phone: gx.phone || undefined },
          });

          await this.prisma.studentGuardian.upsert({
            where: { tenantId_studentId_guardianId: { tenantId, studentId: student.id, guardianId: guardian.id } },
            create: { tenantId, studentId: student.id, guardianId: guardian.id, relationship: 'guardian' },
            update: {},
          });

          results.createdGuardians++;
        }

        // Class & enrollment
        const className = m.classroom ? String(row[m.classroom] || '').trim() : '';
        if (body.createClasses !== false && className) {
          const classroom = await this.prisma.classroom.upsert({
            where: { tenantId_name: { tenantId, name: className } },
            create: { tenantId, name: className, subject: null, grade: grade || null, schoolId },
            update: {},
          });

          await this.prisma.enrollment.upsert({
            where: {
              tenantId_classroomId_studentId: { tenantId, classroomId: classroom.id, studentId: student.id },
            },
            create: { tenantId, classroomId: classroom.id, studentId: student.id },
            update: {},
          });

          results.createdClasses++;
          results.createdEnrollments++;
        }
      } catch (e: any) {
        results.errors.push(e?.message || String(e));
      }
    }

    return results;
  }
}
