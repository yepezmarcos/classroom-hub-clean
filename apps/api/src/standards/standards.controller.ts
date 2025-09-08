import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { StandardsService } from './standards.service';
import { LearningSkillsService } from '../learning-skills/learning-skills.service';

@Controller('standards')
export class StandardsController {
  constructor(
    private svc: StandardsService,
    private ls: LearningSkillsService, // <-- inject LS service (alias for seeding)
  ) {}

  @Get('sets')
  listSets(@Query('type') type?: 'GENERAL' | 'SUBJECT') {
    return this.svc.listSets(type);
  }

  @Get('sets/:id/skills')
  listSkills(
    @Param('id') id: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
  ) {
    return this.svc.listSkills(id, q, category);
  }

  @Get('sets/:id/categories')
  async listCats(@Param('id') id: string) {
    return this.svc.listCategories(id);
  }

  /** Always returns the *active* LS set (aligned to Settings) + categories */
  @Get('active/ls')
  getActiveLs() {
    return this.svc.getActiveLearningSkillsSet();
  }

  /**
   * 🔁 Alias used by the web app to (re)seed/sync LS skills from current Settings.
   * Delegates to LearningSkillsService.syncFromSettings()
   */
  @Post('seed-learning-skills')
  async seedLearningSkills(@Body() body: any) {
    const force = body?.force ?? true;
    const result = await this.ls.syncFromSettings({ force });
    return { ok: true, ...result };
  }
}