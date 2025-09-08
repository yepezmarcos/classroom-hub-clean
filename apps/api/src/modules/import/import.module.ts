import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ImportController } from './import.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MulterModule.register({})],
  controllers: [ImportController],
})
export class ImportModule {}
