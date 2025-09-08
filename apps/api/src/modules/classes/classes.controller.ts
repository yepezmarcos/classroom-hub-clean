
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('classes')
@UseGuards(JwtGuard)
export class ClassesController {
constructor(private prisma: PrismaService) {}

@Get()
async list(@Req() req: any) {
const { tenantId } = req.user;
return this.prisma.classroom.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 200 });
}

@Post()
async create(@Req() req: any, @Body() body: { name: string; grade?: string; subject?: string }) {
const { tenantId } = req.user;
return this.prisma.classroom.create({ data: { tenantId, name: body.name, grade: body.grade, subject: body.subject } });
}
}
