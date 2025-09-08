import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma.service';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list() {
    return this.students.findMany();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.students.findOneHydrated(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.students.createOne(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.prisma.student.update({
      where: { id },
      data: {
        first: body.first ?? undefined,
        last: body.last ?? undefined,
        grade: body.grade ?? null,
        email: body.email ?? null,
        gender: body.gender ?? null,
        pronouns: body.pronouns ?? null,
        iep: typeof body.iep === 'boolean' ? body.iep : undefined,
        ell: typeof body.ell === 'boolean' ? body.ell : undefined,
        medical: typeof body.medical === 'boolean' ? body.medical : undefined,
      },
    });
  }

  @Post(':id/notes')
  async addNote(@Param('id') id: string, @Body() body: any) {
    const tags: string[] = Array.isArray(body?.tags) ? body.tags : [];
    return this.prisma.note.create({
      data: {
        studentId: id,
        body: String(body?.body || ''),
        tags,
      } as any,
    });
  }
}