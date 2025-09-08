import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma.service';
import { LearningSkillsModule } from '../learning-skills/learning-skills.module';
import { BoardDiscoveryService } from './board-discovery.service';

@Module({
  imports: [
    LearningSkillsModule, // exports LearningSkillsService used by controller
  ],
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService, BoardDiscoveryService],
  exports: [SettingsService],
})
export class SettingsModule {}