import { Module } from '@nestjs/common';
import { GradesController } from './grades.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [GradesController],
  providers: [PrismaService],
})
export class GradesModule {}