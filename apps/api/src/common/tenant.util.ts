import { PrismaService } from '../prisma.service';
import { Request } from 'express';

export async function resolveTenant(prisma: PrismaService, req: Request) {
  const headerId =
    (req.headers['x-tenant-id'] as string) ||
    (req.headers['x-tenant'] as string) ||
    null;

  if (headerId) {
    const t = await prisma.tenant.findUnique({ where: { id: headerId } });
    if (t) return t;
  }

  // Ensure a dev tenant for local
  const dev = await prisma.tenant.upsert({
    where: { id: 'dev-tenant' },
    update: {},
    create: { id: 'dev-tenant', name: 'Dev Tenant' },
  });
  return dev;
}