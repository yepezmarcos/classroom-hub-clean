import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';

type MagicPayload = { sub: string; email: string; tenantId: string; typ: 'magic' };

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {
    const key = process.env.SENDGRID_API_KEY;
    if (key) sgMail.setApiKey(key);
  }

  private signMagicToken(payload: MagicPayload) {
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
  }

  private decodeMagicToken(token: string): MagicPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as MagicPayload;
  }

  private async sendMail(to: string, subject: string, html: string, text: string) {
    const from = process.env.EMAIL_FROM || 'Classroom Hub <no-reply@classroomhub.local>';
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send({ to, from, subject, html, text });
        return { ok: true, provider: 'sendgrid' as const };
      } catch (err: any) {
        const details = err?.response?.body || err?.message || err;
        console.error('[SendGrid error]', details);
        // fall through to SMTP fallback
      }
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '2025', 10),
      secure: false,
    });
    await transporter.sendMail({ from, to, subject, html, text });
    return { ok: true, provider: 'smtp' as const };
  }

  async requestMagicLink(email: string) {
    const normalized = email.trim().toLowerCase();

    const user = await this.prisma.user.upsert({
      where: { email: normalized },
      update: {},
      create: { email: normalized, name: normalized.split('@')[0] },
    });

    let membership = await this.prisma.membership.findFirst({ where: { userId: user.id } });
    if (!membership) {
      const tenant = await this.prisma.tenant.create({ data: { name: `${user.name || 'My'} Workspace` } });
      membership = await this.prisma.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'owner' },
      });
    }

    const token = this.signMagicToken({
      sub: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      typ: 'magic',
    });

    const url = new URL('/auth/callback', process.env.APP_BASE_URL || 'http://localhost:3000');
    url.searchParams.set('token', token);
    url.searchParams.set('email', normalized);

    const subject = 'Your sign-in link for Classroom Hub';
    const text = `Click to sign in: ${url.toString()}\nThis link expires in 15 minutes.`;
    const html =
      `<p>Click to sign in:</p>` +
      `<p><a href="${url.toString()}">${url.toString()}</a></p>` +
      `<p>This link expires in 15 minutes.</p>`;

    const sent = await this.sendMail(normalized, subject, html, text);
    console.log('[Magic link]', url.toString(), `(via ${sent.provider})`);
    return { ok: true, via: sent.provider };
  }

  async verifyMagicToken(token: string) {
    const payload = this.decodeMagicToken(token);
    if (!payload || payload.typ !== 'magic') throw new Error('Invalid token type');
    if (!payload.sub) throw new Error('Invalid token (missing sub)');
    if (!payload.tenantId) throw new Error('Invalid token (missing tenantId)');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new Error('User not found');

    const apiToken = jwt.sign(
      { sub: user.id, tenantId: payload.tenantId, typ: 'session' },
      process.env.JWT_SECRET!,
      { expiresIn: '2h' },
    );

    return { id: user.id, email: user.email, name: user.name, tenantId: payload.tenantId, apiToken };
  }
}