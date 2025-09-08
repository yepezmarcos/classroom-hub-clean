import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { loadDev } from '../fallback/dev-store';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    try {
      return await this.prisma.classroom.findMany({
        orderBy: [{ name: 'asc' }],
      });
    } catch {
      const dev = loadDev();
      return dev.classrooms;
    }
  }
}