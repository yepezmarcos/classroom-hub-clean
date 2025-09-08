import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ApiOrInternalGuard } from '../../guards/api-or-internal.guard';

@Module({
  controllers: [StudentsController],
  providers: [PrismaService, ApiOrInternalGuard],
})
export class StudentsModule {}