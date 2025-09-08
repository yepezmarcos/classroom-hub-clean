import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { sendMail } from '../lib/mailer';
import { createId as cuid } from '@paralleldrive/cuid2';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:4000';
const MAGIC_LINK_BASE_URL = process.env.MAGIC_LINK_BASE_URL || 'http://localhost:3000';

// 1) Start magic link: POST /auth/magic/start { email }
router.post('/magic/start', async (req, res) => {
  try {
    const email = (req.body?.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Ensure user exists
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        id: cuid(),
        email,
        name: email.split('@')[0],
        createdAt: new Date(),
      },
    });

    // Optional: ensure a default tenant + membership
    let tenant = await prisma.tenant.findFirst({ where: { name: 'Default School' } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { id: cuid(), name: 'Default School', createdAt: new Date() } });
    }
    const existing = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, userId: user.id },
    });
    if (!existing) {
      await prisma.membership.create({
        data: { id: cuid(), tenantId: tenant.id, userId: user.id, role: 'Teacher' },
      });
    }

    // Create a short-lived token (15 min)
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        t: 'magic',
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Verify URL lives on the API (so it can set the cookie), then redirects to web
    const verifyUrl = `${API_PUBLIC_URL}/auth/magic/verify?token=${encodeURIComponent(token)}`;

    // Send the email
    await sendMail({
      to: user.email,
      subject: 'Your Classroom Hub sign-in link',
      text: `Click to sign in: ${verifyUrl}`,
      html: `<p>Click to sign in:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 15 minutes.</p>`,
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('magic/start error', err);
    return res.status(500).json({ error: 'Failed to start magic link flow' });
  }
});

// 2) Verify magic link: GET /auth/magic/verify?token=...
router.get('/magic/verify', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).send('Missing token');

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (!payload?.sub || payload?.t !== 'magic') return res.status(400).send('Invalid token');

    // Optional: ensure the user still exists
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).send('User not found');

    // Create a longer-lived session token (e.g., 7 days)
    const session = jwt.sign(
      { sub: user.id, email: user.email, t: 'session' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('ch.session', session, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Redirect back to the web app
    const redirectTo = `${MAGIC_LINK_BASE_URL}/auth/complete?ok=1`;
    return res.redirect(302, redirectTo);
  } catch (err: any) {
    console.error('magic/verify error', err);
    return res.status(400).send('Invalid or expired link');
  }
});

export default router;