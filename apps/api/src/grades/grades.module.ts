import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GradesController } from './grades.controller';

@Module({
  controllers: [GradesController],
  providers: [PrismaService],
})
export class GradesModule {}