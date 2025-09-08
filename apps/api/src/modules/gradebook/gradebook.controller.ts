import { BadRequestException, Controller, Get, Headers, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Controller('gradebook')
export class GradebookController {
  constructor(private prisma: PrismaService) {}

  @Get('ping')
  ping() {
    return { ok: true };
  }

  @Get()
  async getGradebook(
    @Query('classroomId') classroomId?: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    // 1) require classroomId
    if (!classroomId) {
      throw new BadRequestException('classroomId query param is required');
    }

    // 2) verify classroom exists
    const classroom = await this.prisma.classroom.findUnique({ where: { id: classroomId } as any });
    if (!classroom) throw new BadRequestException('Unknown classroomId');

    // 3) students in this class (via Enrollment)
    //    NOTE: Enrollment table exists in your DB, so Prisma delegate should be present.
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId },
      include: { student: true },
      orderBy: { id: 'asc' },
      take: 2000,
    });

    const students = enrollments.map(e => ({
      id: e.student.id,
      first: e.student.first,
      last: e.student.last,
      email: e.student.email,
      grade: (e.student as any).grade ?? null,
    }));

    // 4) assignments for this classroom
    const assignments = await this.prisma.assignment.findMany({
      where: { classroomId },
      orderBy: [{ createdAt: 'asc' as const }, { name: 'asc' as const }],
      take: 2000,
    });

    // 5) grades for those assignments
    const aIds = assignments.map(a => a.id);
    let grades: Array<{ assignmentId: string; studentId: string; score: number | null }> = [];
    if (aIds.length) {
      const rows = await this.prisma.grade.findMany({
        where: { assignmentId: { in: aIds } },
        select: { assignmentId: true, studentId: true, score: true },
        take: 10000,
      });
      grades = rows;
    }

    return {
      classroom: { id: classroom.id, name: classroom.name, code: (classroom as any).code ?? null },
      students,
      assignments: assignments.map(a => ({ id: a.id, name: a.name, max: a.max })),
      grades,
      tenantId: tenantId || (assignments[0]?.['tenantId'] as any) || null,
    };
  }
}