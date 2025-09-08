import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BootstrapService } from '../bootstrap/bootstrap.service';

import { AuthModule } from '../modules/auth/auth.module';
import { StudentsModule } from '../modules/students/students.module';
import { ClassesModule } from '../modules/classes/classes.module';
import { CommentsModule } from '../modules/comments/comments.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { InternalModule } from './internal/internal.module';

@Module({
  imports: [
    PrismaModule, // important: once per app
    AuthModule,
    StudentsModule,
    ClassesModule,
    CommentsModule,
    SettingsModule,
    InternalModule,
  ],
  providers: [BootstrapService],
})
export class AppModule {}