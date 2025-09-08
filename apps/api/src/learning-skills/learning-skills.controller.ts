import { Body, Controller, Get, Post } from '@nestjs/common';
import { LearningSkillsService } from './learning-skills.service';

@Controller('learning-skills')
export class LearningSkillsController {
  constructor(private ls: LearningSkillsService) {}

  /** Student Profile pulls current categories from here */
  @Get()
  get() {
    return this.ls.getCurrentSchema();
  }

  /** Settings page calls this after changing board/settings */
  @Post('sync-from-settings')
  sync(@Body() body: { force?: boolean }) {
    return this.ls.syncFromSettings(body || {});
  }
}