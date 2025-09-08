import { Injectable } from '@nestjs/common';
import sg from '@sendgrid/mail';

@Injectable()
export class EmailService {
    constructor() {
        if (process.env.SENDGRID_API_KEY) {
            sg.setApiKey(process.env.SENDGRID_API_KEY);
        }
    }

    async send(to: string, subject: string, html: string) {
        if (!process.env.SENDGRID_API_KEY) {
            throw new Error('SENDGRID_API_KEY not set');
        }
        const from = process.env.SENDGRID_FROM || 'noreply@classroomhub.dev';
        await sg.send({ to, from, subject, html });
        return { ok: true };
    }

    async sendHtml(to: string, subject: string, html: string) {
        return this.send(to, subject, html);
    }
}