
import { Module } from '@nestjs/common';
import { StandardsController } from './standards.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [StandardsController] })
export class StandardsModule {}
