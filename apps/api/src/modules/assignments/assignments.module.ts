import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [AssignmentsController],
  providers: [PrismaService],
})
export class AssignmentsModule {}