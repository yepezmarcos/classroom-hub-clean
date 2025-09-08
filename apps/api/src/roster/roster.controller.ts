import {
    Controller, Post, UseInterceptors, UploadedFile, Body, Req, BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RosterService } from './roster.service';
import type { Request } from 'express';
import { z } from 'zod';

const CommitSchema = z.object({
    mapping: z.record(z.string()), // { "First Name":"first", "Last":"last", ... }
    rows: z.array(z.record(z.any())), // parsed preview rows (objects)
    classroomCode: z.string().min(1), // which class to enroll into
    upsertClassroomName: z.string().optional(),
});

@Controller('roster')
export class RosterController {
    constructor(private svc: RosterService) {}

    private tenant(req: Request) {
        return (req.headers['x-tenant-id'] as string) || 'default';
    }

    @Post('preview')
    @UseInterceptors(FileInterceptor('file'))
    async preview(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
        const tenantId = this.tenant(req);
        if (!file) throw new BadRequestException('file is required (CSV)');
        return this.svc.previewCsv(tenantId, file.buffer);
    }

    @Post('commit')
    async commit(@Body() body: unknown, @Req() req: Request) {
        const tenantId = this.tenant(req);
        const parsed = CommitSchema.safeParse(body);
        if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
        const { mapping, rows, classroomCode, upsertClassroomName } = parsed.data;
        return this.svc.commit(tenantId, mapping, rows, classroomCode, upsertClassroomName);
    }
}