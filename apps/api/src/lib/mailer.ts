import type { Transporter } from 'nodemailer';

let _send:
  | ((opts: { to: string; subject: string; text?: string; html?: string; from?: string; replyTo?: string }) => Promise<void>)
  | null = null;

export async function sendMail(opts: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}) {
  if (!_send) _send = await initSender();
  return _send(opts);
}

async function initSender() {
  const apiKey = process.env.SENDGRID_API_KEY || '';
  const from = process.env.SENDGRID_FROM || 'no-reply@classroomhub.local';
  const replyTo = process.env.SENDGRID_REPLY_TO || '';

  if (apiKey) {
    const sg = await import('@sendgrid/mail');
    sg.setApiKey(apiKey);
    return async ({ to, subject, text, html, from: f, replyTo: r }) => {
      await sg.send({
        to,
        from: f || from,
        ...(replyTo || r ? { replyTo: r || replyTo } : {}),
        subject,
        text,
        html,
      } as any);
    };
  }

  // Dev: MailHog SMTP -> http://localhost:8025
  try {
    const nodemailer = await import('nodemailer');
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '1025', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const transporter: Transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: user && pass ? { user, pass } : undefined,
    });
    return async ({ to, subject, text, html, from: f, replyTo: r }) => {
      await transporter.sendMail({
        to,
        from: f || from,
        replyTo: r || replyTo || undefined,
        subject,
        text,
        html,
      });
    };
  } catch {
    // Fallback: console
    return async ({ to, subject, text, html }) => {
      console.log('✉️  [DEV EMAIL]', { to, subject, text, html });
    };
  }
}