import { Body, Controller, Get, Put, Post, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { LearningSkillsService } from '../learning-skills/learning-skills.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private settings: SettingsService,
    private ls: LearningSkillsService,
  ) {}

  @Get()
  get() {
    // now returns a persisted row (service creates one if missing)
    return this.settings.get();
  }

  @Put()
  async put(@Body() body: any) {
    const saved = await this.settings.upsertSettings(body);
    const sync = await this.ls.syncFromSettings({ force: true });
    return { ...saved, _synced: sync };
  }

  @Post()
  async post(@Body() body: any) {
    const saved = await this.settings.upsertSettings(body);
    const sync = await this.ls.syncFromSettings({ force: true });
    return { ...saved, _synced: sync };
  }

  // 🔁 optional manual re-sync (useful after scripted data changes)
  @Post('sync-ls')
  async syncLs() {
    const sync = await this.ls.syncFromSettings({ force: true });
    return { ok: true, _synced: sync };
  }

  @Get('options')
  options(
    @Query('country') country?: string,
    @Query('stateProvince') stateProvince?: string,
    @Query('city') city?: string,
    @Query('q') q?: string,
  ) {
    return this.settings.options({ country, stateProvince, city, q });
  }

  @Get('options/boards')
  boards(
    @Query('country') country: string,
    @Query('region') region?: string,
    @Query('stateProvince') stateProvince?: string,
    @Query('city') city?: string,
    @Query('q') q?: string,
  ) {
    return this.settings.findBoardsAI({ country, region, stateProvince, city, q });
  }

  @Post('ai/bootstrap')
  async aiBootstrap(@Body() body: any) {
    const saved = await this.settings.aiBootstrap(body || {});
    const sync = await this.ls.syncFromSettings({ force: true });
    return { ...saved, _synced: sync };
  }
}