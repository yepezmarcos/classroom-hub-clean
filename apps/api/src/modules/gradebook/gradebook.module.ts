import { Module } from '@nestjs/common';
import { GradebookController } from './gradebook.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [GradebookController],
  providers: [PrismaService],
  exports: [],
})
export class GradebookModule {}