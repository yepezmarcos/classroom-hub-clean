import { Module } from '@nestjs/common';
import { LearningSkillsService } from './learning-skills.service';
import { LearningSkillsController } from './learning-skills.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [LearningSkillsService, PrismaService],
  controllers: [LearningSkillsController],
  exports: [LearningSkillsService],
})
export class LearningSkillsModule {}