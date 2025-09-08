import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ClassesController } from './classes.controller';

@Module({
  controllers: [ClassesController],
  providers: [PrismaService],
})
export class ClassesModule {}