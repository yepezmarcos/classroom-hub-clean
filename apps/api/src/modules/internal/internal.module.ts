// apps/api/src/modules/internal/internal.module.ts
import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [InternalController],
  providers: [PrismaService],
})
export class InternalModule {}