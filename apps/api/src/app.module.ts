import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Controllers
import { AiController } from './ai/ai.controller';
import { StudentsController } from './students/students.controller';
import { CommentsController } from './comments/comments.controller';
import { SettingsController } from './settings/settings.controller';
import { AssignmentsController } from './assignments/assignments.controller';
import { GradesController } from './grades/grades.controller';
import { GradebookController } from './gradebook/gradebook.controller';
import { HealthController } from './health.controller';
import { DevController } from './dev/dev.controller';

// Feature modules
import { StudentsModule } from './students/students.module';
import { StandardsModule } from './standards/standards.module';
import { CommentsModule } from './comments/comments.module';
import { SettingsModule } from './settings/settings.module';
import { LearningSkillsModule } from './learning-skills/learning-skills.module';
import { AiModule } from './ai/ai.module';
import { ClassesModule } from './classes/classes.module';

// ONLY modules/*
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { GradesModule } from './modules/grades/grades.module';
import { GradebookModule } from './modules/gradebook/gradebook.module';
import { EmailModule } from './email/email.module';
import { RosterModule } from './roster/roster.module';
import { BehaviorModule } from './behavior/behavior.module';
import { ReportsModule } from './reports/reports.module';
import { DigestModule } from './digest/digest.module';


// Services (app-scoped)
import { SettingsService } from './settings/settings.service';
import { OpenAIService } from './ai/openai.service';

@Module({
  imports: [
    StudentsModule,
    StandardsModule,
    CommentsModule,
    SettingsModule,
    LearningSkillsModule,
    AiModule,
    ClassesModule,
    AssignmentsModule,
    GradesModule,
    GradebookModule,
    ReportsModule,
    EmailModule,
    DigestModule,
    BehaviorModule,
    RosterModule,
  ],
  controllers: [
    AiController,
    StudentsController,
    CommentsController,
    SettingsController,
    AssignmentsController,
    GradesController,
    GradebookController,
    HealthController,
    DevController,
  ],
  providers: [
    PrismaService,
    SettingsService,
    OpenAIService,
  ],
})
export class AppModule {}