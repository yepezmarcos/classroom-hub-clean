import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller('gradebook')
export class GradebookController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getClassGradebook(@Query('classroomId') classroomId?: string) {
    if (!classroomId) throw new Error('classroomId is required');

    // 1) classroom
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { id: true, name: true, code: true },
    });
    if (!classroom) throw new Error('Classroom not found');

    // 2) roster (students via enrollments)
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId },
      select: {
        student: { select: { id: true, first: true, last: true } },
      },
      orderBy: [{ student: { last: 'asc' } }, { student: { first: 'asc' } }],
      take: 2000,
    });
    const students = enrollments
      .map((e) => e.student)
      .filter(Boolean);

    // 3) assignments for this class
    const assignments = await this.prisma.assignment.findMany({
      where: { classroomId },
      select: { id: true, name: true, max: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    const assignmentIds = assignments.map((a) => a.id);

    // 4) grades for those assignments + students
    let grades: Array<{ assignmentId: string; studentId: string; score: number | null }> = [];
    if (assignmentIds.length && students.length) {
      grades = await this.prisma.grade.findMany({
        where: { assignmentId: { in: assignmentIds } },
        select: { assignmentId: true, studentId: true, score: true },
        take: 100000,
      });
    }

    return {
      class: classroom,
      students,
      assignments,
      grades,
    };
  }
}