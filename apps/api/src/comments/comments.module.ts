import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma.service';
import { OpenAIService } from '../ai/openai.service';
import { StandardsModule } from '../standards/standards.module';
import { StandardsService } from '../standards/standards.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StandardsModule, // <-- so CommentsService can resolve skill/category
  ],
  controllers: [CommentsController],
  providers: [CommentsService, PrismaService, OpenAIService, StandardsService],
  exports: [CommentsService],
})
export class CommentsModule {}