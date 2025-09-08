import { Controller, Post, Body, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { DigestService } from './digest.service';

const Schema = z.object({
    studentId: z.string().min(1),
    guardianEmail: z.string().email().optional(),
    language: z.enum(['en','es','fr']).default('en')
});

@Controller('digest')
export class DigestController {
    constructor(private svc: DigestService) {}
    private tenant(req: Request){ return (req.headers['x-tenant-id'] as string) || 'default'; }

    @Post('preview')
    async preview(@Body() body: unknown, @Req() req: Request) {
        const tenantId = this.tenant(req);
        const parsed = Schema.safeParse(body);
        if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
        return this.svc.preview(tenantId, parsed.data);
    }

    @Post('sendNow')
    async sendNow(@Body() body: unknown, @Req() req: Request) {
        const tenantId = this.tenant(req);
        const parsed = Schema.safeParse(body);
        if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
        return this.svc.sendNow(tenantId, parsed.data);
    }
}
