# Classroom Hub SaaS (Modern v5)

**Monorepo**
- `apps/api` — NestJS + Prisma + PostgreSQL. JWT magic-link auth, multi-tenant, standards (GENERAL/SUBJECT + categories), comment bank (+ AI generate + live suggestions), students, classes, assignments/grades, contacts (email via MailHog/SMTP or SendGrid), Stripe wiring.
- `apps/web` — Next.js App Router + NextAuth (magic link via credentials). Modern UI (cards, shadows, animations), students, classes, gradebook, AI comment bank, contacts, settings.

## Prereqs
- Node 18+
- Docker (for local hosting)
- Vercel
- Render
- NeonDB (for the DataBase)
- Stripe CLI (for webhook tests)

## Quickstart
```bash
npm i
docker compose up -d
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run db:migrate
npm run dev
Dev URLs

Web: http://localhost:3000 (Local host)

Web: https://classroomhub.onrender.com (render deployment)

API Health: http://localhost:4000/health (local host)

Adminer (DB UI): http://localhost:8080 (server: postgres, user: hub, pass: hub, db: hub) (local host)

NeonDB: 'postgresql://neondb_owner:npg_dB7mXEk4QzYL@ep-royal-mountain-adwgabbm-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

MailHog (Email UI): http://localhost:8025 (SMTP host=localhost, port=2025)

Sign-in

Visit http://localhost:3000/login and enter your email

Open MailHog http://localhost:8025 → open the email → click the link to sign in

Optional

OpenAI: set OPENAI_API_KEY in apps/api/.env for better AI.

Stripe: set STRIPE_SECRET_KEY, STRIPE_PRICE_PRO_MONTHLY, STRIPE_WEBHOOK_SECRET in apps/api/.env.
