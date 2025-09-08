import { Controller, Post, Body, Get, Query, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { BehaviorService } from './behavior.service';

const LogSchema = z.object({
    studentId: z.string().min(1),
    tag: z.string().min(1), // e.g., Disruption|Kindness|Missing HW|On Task
    note: z.string().optional(),
    occurredAt: z.string().optional(), // ISO
});

@Controller('behavior')
export class BehaviorController {
    constructor(private svc: BehaviorService) {}
    private tenant(req: Request) { return (req.headers['x-tenant-id'] as string) || 'default'; }

    @Post('log')
    async log(@Body() body: unknown, @Req() req: Request) {
        const tenantId = this.tenant(req);
        const parsed = LogSchema.safeParse(body);
        if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
        return this.svc.log(tenantId, parsed.data);
    }

    @Get('timeline')
    async timeline(@Query('studentId') studentId: string, @Req() req: Request) {
        const tenantId = this.tenant(req);
        if (!studentId) throw new BadRequestException('studentId required');
        return this.svc.timeline(tenantId, studentId);
    }

    @Get('suggestions')
    async suggestions(@Query('studentId') studentId: string, @Req() req: Request) {
        const tenantId = this.tenant(req);
        if (!studentId) throw new BadRequestException('studentId required');
        return this.svc.suggestions(tenantId, studentId);
    }
}