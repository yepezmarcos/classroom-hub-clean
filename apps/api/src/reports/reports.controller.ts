import { Controller, Post, Body, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ReportsService } from './reports.service';

const GenSchema = z.object({
    studentId: z.string().min(1),
    tone: z.enum(['Formal','Encouraging','Concise']).default('Encouraging'),
    term: z.string().default('T1')
});

const SaveSchema = z.object({
    studentId: z.string().min(1),
    term: z.string().min(1),
    content: z.string().min(5)
});

@Controller('reports')
export class ReportsController {
    constructor(private svc: ReportsService) {}
    private tenant(req: Request) { return (req.headers['x-tenant-id'] as string) || 'default'; }

    @Post('generate')
    async generate(@Body() body: unknown, @Req() req: Request) {
        const tenantId = this.tenant(req);
        const parsed = GenSchema.safeParse(body);
        if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
        return this.svc.generate(tenantId, parsed.data);
    }

    @Post('save')
    async save(@Body() body: unknown, @Req() req: Request) {
        const tenantId = this.tenant(req);
        const parsed = SaveSchema.safeParse(body);
        if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
        return this.svc.save(tenantId, parsed.data);
    }
}