import { Body, Controller, Post, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

type SendBody = {
  studentId: string;
  to?: string[];       // optional — if omitted, will send to all guardian emails
  subject: string;
  body: string;        // plain-text for now (keeps Mailhog happy)
};

@UseGuards(JwtGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private prisma: PrismaService) {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  async privateRecipients(tenantId: string, studentId: string) {
    const s = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        studentGuardians: { include: { guardian: true } },
      },
    });
    if (!s) throw new BadRequestException('Student not found');
    const emails = s.studentGuardians
      .map(sg => sg.guardian.email?.trim())
      .filter(Boolean) as string[];
    return Array.from(new Set(emails));
  }

  @Post('send')
  async send(@Req() req: any, @Body() body: SendBody) {
    const { tenantId } = req.user;
    if (!body.subject?.trim() || !body.body?.trim()) {
      throw new BadRequestException('Subject and body required');
    }
    const recipients = (body.to && body.to.length > 0)
      ? body.to
      : await this.privateRecipients(tenantId, body.studentId);

    if (recipients.length === 0) {
      throw new BadRequestException('No recipient emails found for this student.');
    }

    const from = process.env.MAIL_FROM || 'marcos@classroomhub.ca';

    // Prefer SendGrid when present
    if (process.env.SENDGRID_API_KEY) {
      await sgMail.sendMultiple({
        to: recipients,
        from,
        subject: body.subject,
        text: body.body,
      });
      return { ok: true, transport: 'sendgrid', to: recipients };
    }

    // Fallback to Mailhog/SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '2025', 10),
      secure: false,
    });

    await transporter.sendMail({
      from,
      to: recipients.join(','),
      subject: body.subject,
      text: body.body,
    });

    return { ok: true, transport: 'smtp', to: recipients };
  }
}