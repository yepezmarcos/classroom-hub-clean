import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import Stripe from 'stripe';
import { JwtGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

@Controller('billing')
export class BillingController {
  constructor(private prisma: PrismaService) {}

  @Post('create-checkout-session')
  @UseGuards(JwtGuard)
  async createCheckout(@Req() req: any) {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_PRO_MONTHLY) {
      throw new Error('Stripe is not configured');
    }
    const { tenantId } = req.user;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    const successUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?upgraded=1`;
    const cancelUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_PRO_MONTHLY!, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: tenant?.stripeId || undefined,
      metadata: { tenantId },
    });

    return { url: session.url };
  }

  @Post('webhook')
  async webhook(@Req() req: any, @Res() res: Response, @Body() _body: any) {
    if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
      return res.status(200).json({ ok: true, skipped: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!sig) return res.status(400).send('Missing stripe-signature header');

    let event: Stripe.Event;
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

    try {
      // express.raw in main.ts ensures req.body is a Buffer
      event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const customerId = (session.customer as string) || null;
      if (tenantId) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { plan: 'pro', stripeId: customerId || undefined },
        });
      }
    }

    return res.json({ received: true });
  }
}