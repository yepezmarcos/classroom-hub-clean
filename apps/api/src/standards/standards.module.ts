import { Module } from '@nestjs/common';
import { StandardsController } from './standards.controller';
import { StandardsService } from './standards.service';
import { PrismaService } from '../prisma.service';
import { AiModule } from '../ai/ai.module';
import { SettingsService } from '../settings/settings.service';
import { OpenAIService } from '../ai/openai.service';
import { LearningSkillsModule } from '../learning-skills/learning-skills.module';
import { LearningSkillsService } from '../learning-skills/learning-skills.service';

@Module({
  imports: [
    AiModule,
    LearningSkillsModule, // <-- so controller can use LS service
  ],
  controllers: [StandardsController],
  providers: [
    StandardsService,
    PrismaService,
    SettingsService,
    OpenAIService,
    LearningSkillsService, // provided by module too
  ],
  exports: [StandardsService],
})
export class StandardsModule {}