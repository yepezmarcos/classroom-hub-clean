import { Global, Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { AiController } from './ai.controller';
@Global()
@Module({
  controllers: [AiController],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class AiModule {}