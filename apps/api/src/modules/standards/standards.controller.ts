
import { Controller, Get, Post, Query, Param, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('standards')
@UseGuards(JwtGuard)
export class StandardsController {
constructor(private prisma: PrismaService) {}

@Get('sets')
async listSets(
@Req() req: any,
@Query('type') type?: 'GENERAL' | 'SUBJECT',
@Query('jurisdiction') jurisdiction?: string,
@Query('subject') subject?: string,
@Query('gradeBand') gradeBand?: string
) {
const { tenantId } = req.user;
return this.prisma.standardSet.findMany({
where: {
tenantId,
...(type ? { type } : {}),
...(jurisdiction ? { jurisdiction } : {}),
...(gradeBand ? { gradeBand } : {}),
...(subject ? { subject } : {}),
},
orderBy: { updatedAt: 'desc' },
take: 200,
});
}

@Get('sets/:id/skills')
async listSkills(
@Req() req: any,
@Param('id') setId: string,
@Query('category') category?: string,
@Query('q') q?: string
) {
const { tenantId } = req.user;
return this.prisma.standardSkill.findMany({
where: {
set: { id: setId, tenantId },
...(category ? { category } : {}),
...(q ? { OR: [
{ label: { contains: q, mode: 'insensitive' } },
{ description: { contains: q, mode: 'insensitive' } },
{ code: { contains: q, mode: 'insensitive' } }
] } : {}),
},
orderBy: { updatedAt: 'desc' },
take: 400,
});
}

@Get('sets/:id/categories')
async listCategories(@Req() req: any, @Param('id') setId: string) {
const { tenantId } = req.user;
const cats = await this.prisma.standardSkill.findMany({
where: { set: { id: setId, tenantId }, NOT: { category: null } },
select: { category: true },
distinct: ['category'],
});
return cats.map(c => c.category).filter(Boolean);
}

@Post('seed-learning-skills')
async seedLearningSkills(@Req() req: any) {
const { tenantId } = req.user;
const set = await this.prisma.standardSet.create({
data: {
tenantId,
type: 'GENERAL',
jurisdiction: 'CA-ON',
subject: null,
gradeBand: 'K-6',
name: 'Ontario Learning Skills (sample)',
framework: 'Learning Skills',
skills: {
create: [
{ category: 'Responsibility', label: 'Fulfills responsibilities and commitments' },
{ category: 'Organization', label: 'Uses time effectively to complete tasks' },
{ category: 'Independent Work', label: 'Monitors, assesses, and revises plans' },
{ category: 'Collaboration', label: 'Works with others in a team' },
{ category: 'Initiative', label: 'Demonstrates curiosity and new learning' },
{ category: 'Self-Regulation', label: 'Sets goals and monitors progress' },
],
},
},
include: { skills: true },
});
return set;
}

@Post('seed-subject-sample')
async seedSubjectSample(@Req() req: any) {
const { tenantId } = req.user;
const set = await this.prisma.standardSet.create({
data: {
tenantId,
type: 'SUBJECT',
jurisdiction: 'CA-ON',
subject: 'ELA',
gradeBand: '3-5',
name: 'Ontario Language Arts (sample)',
skills: {
create: [
{ label: 'Reads with increasing fluency', code: 'ELA.RF.3.1', description: 'Applies appropriate strategies to read grade-level texts.' },
{ label: 'Identifies main idea and details', code: 'ELA.RI.3.2' },
{ label: 'Writes organized paragraphs', code: 'ELA.W.3.3', description: 'Uses topic sentences and supporting details.' },
],
},
},
include: { skills: true },
});
return set;
}
}
