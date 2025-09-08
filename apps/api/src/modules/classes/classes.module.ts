
import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [ClassesController] })
export class ClassesModule {}
