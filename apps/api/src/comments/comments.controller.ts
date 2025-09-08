import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CommentsService } from './comments.service';

@Controller('comments')
export class CommentsController {
  constructor(private readonly svc: CommentsService) {}

  @Get()
  async list(@Query('level') level?: string, @Query('q') q?: string) {
    const lv = (level || '').toUpperCase();
    const allowed = ['E','G','S','NS','NEXTSTEPS','END'];
    const norm = allowed.includes(lv) ? (lv === 'NEXTSTEPS' ? 'NextSteps' : lv) : undefined;
    return this.svc.list({ level: (norm as any) || undefined, q: q || undefined });
  }

  // For the student profile generator (skillId or fallback to category)
  @Get('by-skill')
  async bySkill(@Query('skill') skill: string, @Query('level') level?: string) {
    const lv = (level || '').toUpperCase();
    const allowed = ['E','G','S','NS','NEXTSTEPS','END'];
    const norm = allowed.includes(lv) ? (lv === 'NEXTSTEPS' ? 'NextSteps' : lv) : undefined;
    return this.svc.getBySkill(skill, (norm as any) || undefined);
  }

  // NEW: direct by category (use category slug or label)
  @Get('by-category')
  async byCategory(@Query('category') category: string, @Query('level') level?: string) {
    const lv = (level || '').toUpperCase();
    const allowed = ['E','G','S','NS','NEXTSTEPS','END'];
    const norm = allowed.includes(lv) ? (lv === 'NEXTSTEPS' ? 'NextSteps' : lv) : undefined;
    return this.svc.getByCategory(category, (norm as any) || undefined);
  }

  @Get('summary')
  async summary() {
    return this.svc.summary();
  }

  @Get('levels')
  getLevels() {
    return this.svc.getLevelsMapping();
  }

  @Post()
  async create(@Body() body: any) {
    // Accepts: { text, skillIds?: string[], category?: string, level?: 'E'|'G'|'S'|'NS'|'NextSteps'|'END', subject?, gradeBand?, tags? }
    return this.svc.create(body);
  }

  @Delete(':id')
  async removeByParam(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Delete()
  async removeByQuery(@Query('id') id: string) {
    return this.svc.remove(id);
  }

  @Post('seed/ontario-ls')
  async seedOntario() {
    return this.svc.seedOntarioLearningSkills();
  }

  @Post('backfill-ontario-tags')
  async backfillOntario() {
    return this.svc.backfillOntarioCategoryTags();
  }

  @Post('backfill-levels')
  async backfillLv() {
    return this.svc.backfillLevels();
  }
}